import json
from pathlib import Path
from collections import deque

import numpy as np
from openai import OpenAI


def load_taxonomy(json_path: Path):
    # carrega o json bruto
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    concept_set = data["conceptSet"]

    concepts_by_uri = {c["uri"]: c for c in concept_set}
    concepts_by_qcode = {c["qcode"]: c for c in concept_set}

    children = {c["qcode"]: [] for c in concept_set}
    parent = {}

    for c in concept_set:
        qcode = c["qcode"]
        for child_q in c.get("narrower", []):
            children.setdefault(qcode, []).append(child_q)
            parent[child_q] = qcode

    roots_qcodes = []
    for uri in data.get("hasTopConcept", []):
        concept = concepts_by_uri.get(uri)
        if concept:
            roots_qcodes.append(concept["qcode"])

    level = {}
    queue = deque()

    for root_q in roots_qcodes:
        level[root_q] = 1
        queue.append(root_q)

    while queue:
        current = queue.popleft()
        current_level = level[current]
        for child_q in children.get(current, []):
            if child_q in level:
                continue
            level[child_q] = current_level + 1
            queue.append(child_q)

    return data, concepts_by_qcode, children, parent, level, roots_qcodes


def get_label(concept: dict, lang: str = "pt-BR") -> str:
    # pega o rotulo em pt-br ou fallback
    labels = concept.get("prefLabel", {}) or {}
    if lang in labels:
        return labels[lang]
    if "en-GB" in labels:
        return labels["en-GB"]
    if labels:
        return next(iter(labels.values()))
    return concept.get("qcode", "<sem rotulo>")


def get_definition(concept: dict, lang: str = "pt-BR") -> str:
    # pega a definicao em pt-br ou fallback
    defs = concept.get("definition", {}) or {}
    if lang in defs:
        return defs[lang]
    if "en-GB" in defs:
        return defs["en-GB"]
    if defs:
        return next(iter(defs.values()))
    return ""


class IptcEmbeddingTree:
    def __init__(
        self,
        json_path: str,
        embeddings_path: str,
        embedding_model: str = "text-embedding-3-small",
    ):
        # carrega taxonomia
        (
            _data,
            self.concepts_by_qcode,
            self.children,
            self.parent,
            self.level,
            self.roots,
        ) = load_taxonomy(Path(json_path))

        # carrega embeddings
        emb_data = np.load(embeddings_path, allow_pickle=True)
        self.qcodes = emb_data["qcodes"].tolist()
        self.emb_matrix = emb_data["embeddings"].astype("float32")

        # mapa qcode -> indice na matriz
        self.qcode_to_idx = {q: i for i, q in enumerate(self.qcodes)}

        # cliente da openai para embedar claims e usar llm
        self.client = OpenAI()
        self.embedding_model = embedding_model

    def _cosine_for_qcodes(self, claim_vec: np.ndarray, qcodes: list[str]):
        # calcula similaridade coseno entre claim e lista de qcodes
        idxs = [self.qcode_to_idx[q] for q in qcodes if q in self.qcode_to_idx]
        if not idxs:
            return {}
        mat = self.emb_matrix[idxs]  # shape (N, D)
        num = mat @ claim_vec
        denom = (
            np.linalg.norm(mat, axis=1) * np.linalg.norm(claim_vec) + 1e-8
        )
        sims = num / denom
        return {self.qcodes[i]: float(s) for i, s in zip(idxs, sims)}

    def embed_claim(self, text: str) -> np.ndarray:
        # gera embedding para um claim
        resp = self.client.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        vec = np.array(resp.data[0].embedding, dtype="float32")
        return vec

    def classify_claim(
        self,
        text: str,
        max_depth: int = 5,
        top_k_roots: int = 3,
        rerank_with_llm: bool = False,
        llm_model: str = "gpt-4.1-mini",
    ) -> list[dict]:
        """
        classifica um claim retornando ate top_k_roots caminhos hierarquicos.
        cada item da lista eh um dict: { "score": float, "nodes": [nos...] }

        se rerank_with_llm=True, usa a llm para escolher o melhor caminho
        entre os candidatos e coloca o escolhido em primeiro lugar da lista.
        """
        # faz embedding do claim
        claim_vec = self.embed_claim(text)

        # 1. calcula similaridade com todas as raizes
        root_sims = self._cosine_for_qcodes(claim_vec, self.roots)
        if not root_sims:
            return []

        # ordena raizes por similaridade decrescente
        sorted_roots = sorted(
            root_sims.items(), key=lambda x: x[1], reverse=True
        )

        # pega no maximo top_k_roots raizes
        top_roots = sorted_roots[:top_k_roots]

        paths_with_scores: list[dict] = []

        # 2. para cada raiz candidata, desce na arvore construindo um caminho
        for root_q, root_sim in top_roots:
            path_nodes = self._build_path_from_root(
                claim_vec=claim_vec,
                start_qcode=root_q,
                start_sim=root_sim,
                max_depth=max_depth,
            )
            if not path_nodes:
                continue

            score = self._score_path(path_nodes)
            paths_with_scores.append(
                {
                    "score": score,
                    "nodes": path_nodes,
                }
            )

        if not paths_with_scores:
            return []

        # ordena caminhos pelo score (maior primeiro, heuristica)
        paths_with_scores.sort(key=lambda x: x["score"], reverse=True)

        # se nao for para usar llm, retorna heuristica pura
        if not rerank_with_llm:
            return paths_with_scores

        # 3. usa llm para escolher o melhor caminho entre os candidatos
        best_idx = self._choose_best_with_llm(
            claim_text=text,
            candidate_paths=paths_with_scores,
            model=llm_model,
        )

        # garante indice valido
        if best_idx < 0 or best_idx >= len(paths_with_scores):
            best_idx = 0

        # reordena lista colocando o melhor em primeiro lugar
        if best_idx != 0:
            best_item = paths_with_scores.pop(best_idx)
            paths_with_scores.insert(0, best_item)

        return paths_with_scores

    def _build_path_from_root(
        self,
        claim_vec: np.ndarray,
        start_qcode: str,
        start_sim: float,
        max_depth: int,
    ) -> list[dict]:
        """
        constroi um caminho descendo a arvore a partir de uma raiz especifica.
        """
        path: list[dict] = []
        current_q = start_qcode
        current_sim = start_sim

        path.append(self._node_info(current_q, current_sim))

        while self.level.get(current_q, 1) < max_depth:
            child_qs = self.children.get(current_q, [])
            if not child_qs:
                break

            child_sims = self._cosine_for_qcodes(claim_vec, child_qs)
            if not child_sims:
                break

            best_child_q = max(child_sims, key=child_sims.get)
            best_child_sim = child_sims[best_child_q]

            # se voce quiser evitar descer para algo muito pior que o pai,
            # pode reativar essa validacao com algum criterio:
            # if best_child_sim + 0.02 < current_sim:
            #     break

            path.append(self._node_info(best_child_q, best_child_sim))
            current_q = best_child_q
            current_sim = best_child_sim

        return path

    def _node_info(self, qcode: str, similarity: float) -> dict:
        concept = self.concepts_by_qcode.get(qcode, {})
        return {
            "qcode": qcode,
            "name": get_label(concept),
            "level": self.level.get(qcode, None),
            "similarity": similarity,
        }

    def _score_path(self, path: list[dict]) -> float:
        """
        calcula um score heuristico para o caminho.
        voce pode tunar essa funcao depois com base em dados reais.

        ideias usadas aqui:
        - valoriza similaridade do no folha
        - considera media de similaridade do caminho
        - considera profundidade (caminhos um pouco mais profundos ganham leve bonus)
        """
        if not path:
            return 0.0

        sims = [n["similarity"] for n in path]
        leaf_sim = sims[-1]
        avg_sim = sum(sims) / len(sims)
        depth = len(path)

        # pesos heurísticos, ajuste a vontade
        score = (
            0.6 * leaf_sim
            + 0.3 * avg_sim
            + 0.1 * (depth / 5.0)  # bonus pequeno por ser mais profundo
        )
        return float(score)

    def _format_paths_for_llm(self, candidate_paths: list[dict]) -> str:
        """
        formata os caminhos candidatos em texto para o prompt da llm.
        """
        lines: list[str] = []
        for idx, item in enumerate(candidate_paths):
            nodes = item["nodes"]
            if not nodes:
                continue
            root = nodes[0]
            leaf = nodes[-1]
            root_concept = self.concepts_by_qcode.get(root["qcode"], {})
            leaf_concept = self.concepts_by_qcode.get(leaf["qcode"], {})

            chain = " > ".join(n["name"] for n in nodes)
            leaf_def = get_definition(leaf_concept)

            lines.append(
                f"Caminho {idx}:\n"
                f"  Cadeia: {chain}\n"
                f"  Categoria raiz: {root['name']} ({root['qcode']})\n"
                f"  Categoria mais especifica: {leaf['name']} ({leaf['qcode']})\n"
                f"  Definicao da categoria mais especifica: {leaf_def}\n"
            )

        return "\n".join(lines)

    def _choose_best_with_llm(
        self,
        claim_text: str,
        candidate_paths: list[dict],
        model: str = "gpt-4.1-mini",
    ) -> int:
        """
        usa uma llm para escolher o melhor caminho entre os candidatos.
        retorna o indice do melhor caminho (0..len-1).
        """
        if not candidate_paths:
            return 0

        # monta texto com os caminhos
        paths_text = self._format_paths_for_llm(candidate_paths)

        system_msg = (
            "You are an assistant helping to classify news claims using the IPTC Media Topics taxonomy.\n"
            "You will receive a claim (in Portuguese) and a small set of candidate classification paths.\n"
            "Each path is an ordered chain from a top-level category to a more specific one.\n"
            "Your task is to pick the SINGLE path that best describes the subject of the claim.\n"
            "Respond ONLY with a JSON object like: {\"index\": 0}\n"
            "where index is the integer of the best path (0, 1, 2, ...)."
        )

        user_msg = (
            f"Claim (portugues): {claim_text}\n\n"
            f"Caminhos candidatos:\n{paths_text}\n\n"
            "Qual caminho descreve melhor o assunto principal desta afirmacao? "
            "Responda apenas com JSON, por exemplo: {\"index\": 1}"
        )

        resp = self.client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
        )

        content = resp.choices[0].message.content or ""
        content = content.strip()

        try:
            data = json.loads(content)
            idx = int(data.get("index", 0))
        except Exception:
            # fallback: se nao conseguir parsear, escolhe o primeiro
            idx = 0

        return idx
