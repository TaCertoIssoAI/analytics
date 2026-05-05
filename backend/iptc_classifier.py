import json
from pathlib import Path
from collections import deque

import numpy as np
from google.genai.types import EmbedContentConfig

from app.services.vertex_client import get_vertex_client


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
        embedding_model: str = "gemini-embedding-001",
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

        # carrega embeddings (um por qcode)
        emb_data = np.load(embeddings_path, allow_pickle=True)
        self.qcodes = emb_data["qcodes"].tolist()
        self.emb_matrix = emb_data["embeddings"].astype("float32")

        # mapa qcode -> indice na matriz
        self.qcode_to_idx = {q: i for i, q in enumerate(self.qcodes)}

        # cliente gemini para embedding + llm
        self.client = get_vertex_client()
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

    def _cosine_all(self, claim_vec: np.ndarray) -> dict:
        """
        calcula similaridade coseno entre o claim e TODOS os topicos iptc.
        retorna dict qcode -> similarity
        """
        # como qcodes e emb_matrix estao alinhados, podemos operar direto na matriz toda
        mat = self.emb_matrix  # shape (N, D)
        num = mat @ claim_vec  # (N,)
        denom = np.linalg.norm(mat, axis=1) * np.linalg.norm(claim_vec) + 1e-8
        sims = num / denom
        return {q: float(s) for q, s in zip(self.qcodes, sims)}

    def embed_claim(self, text: str) -> np.ndarray:
            try:
                resp = self.client.models.embed_content(
                    model=self.embedding_model,
                    contents=[text],
                    config=EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
                )
                vec = np.array(resp.embeddings[0].values, dtype="float32")
                return vec
            except Exception as e:
                print(f"Erro ao gerar embedding: {e}")
                # Retorna vetor de zeros para não travar o fluxo
                return np.zeros(768, dtype="float32")

    def classify_claim(
        self,
        text: str,
        max_depth: int = 5,
        top_k_concepts: int = 5,
        rerank_with_llm: bool = False,
        llm_model: str = "gemini-2.5-flash-lite",
    ) -> dict:
        """
        classifica um claim retornando a categoria vencedora com suas subcategorias.

        retorna um dict:
        {
          "main_category": str,
          "subcategories": [str, str, ...],
          "score": float
        }

        se rerank_with_llm=True, a llm escolhe o melhor caminho.
        """
        # 1. embedding do claim
        claim_vec = self.embed_claim(text)

        # 2. similaridade com TODOS os topicos
        sims = self._cosine_all(claim_vec)
        if not sims:
            return {"main_category": "", "subcategories": [], "score": 0.0}

        # 3. pega os top_k_concepts mais similares (folhas candidatas)
        sorted_concepts = sorted(sims.items(), key=lambda x: x[1], reverse=True)
        top_concepts = sorted_concepts[:top_k_concepts]

        paths_with_scores: list[dict] = []

        # 4. para cada conceito candidato, sobe ate a raiz montando o caminho
        for qcode, leaf_sim in top_concepts:
            path_nodes = self._build_path_to_root(
                qcode=qcode,
                sims=sims,
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
            return {"main_category": "", "subcategories": [], "score": 0.0}

        # 5. ordena por score heuristico
        paths_with_scores.sort(key=lambda x: x["score"], reverse=True)

        if rerank_with_llm:
            # 6. usa llm para escolher o melhor entre os candidatos
            best_idx = self._choose_best_with_llm(
                claim_text=text,
                candidate_paths=paths_with_scores,
                model=llm_model,
            )

            if best_idx < 0 or best_idx >= len(paths_with_scores):
                best_idx = 0

            if best_idx != 0:
                best_item = paths_with_scores.pop(best_idx)
                paths_with_scores.insert(0, best_item)

        # 7. retorna apenas o melhor caminho formatado
        best_path = paths_with_scores[0]
        nodes = best_path["nodes"]

        if not nodes:
            return {"main_category": "", "subcategories": [], "score": 0.0}

        main_category = {"name": nodes[0]["name"], "qcode": nodes[0]["qcode"]}
        subcategories = [{"name": node["name"], "qcode": node["qcode"]} for node in nodes[1:]]

        return {
            "main_category": main_category,
            "subcategories": subcategories,
            "score": best_path["score"]
        }

    def _build_path_to_root(
        self,
        qcode: str,
        sims: dict,
        max_depth: int,
    ) -> list[dict]:
        """
        constrói o caminho da raiz ate o conceito dado,
        subindo pelos pais, e depois invertendo a ordem.

        usa as similaridades ja calculadas em `sims` para preencher
        o campo similarity de cada no.
        """
        path_rev: list[dict] = []
        current_q = qcode

        # sobe ate a raiz ou ate estourar max_depth
        while current_q is not None:
            sim = sims.get(current_q, 0.0)
            node = self._node_info(current_q, sim)
            path_rev.append(node)

            parent_q = self.parent.get(current_q)
            current_q = parent_q

            # se ja tiver ultrapassado o nivel maximo, para de subir
            if len(path_rev) >= max_depth:
                break

        # path_rev esta folha -> raiz; inverte para raiz -> folha
        path = list(reversed(path_rev))

        # opcional: garantir que o primeiro nivel seja 1 e que
        # o caminho nao comece no meio da arvore sem raiz
        # (nesse taxonomy deve estar ok, mas mantemos simple)
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

        score = (
            0.6 * leaf_sim
            + 0.3 * avg_sim
            + 0.1 * (depth / 5.0)
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
        model: str = "gemini-2.5-flash-lite",
    ) -> int:
        """
        usa uma llm para escolher o melhor caminho entre os candidatos.
        retorna o indice do melhor caminho (0..len-1).
        """
        if not candidate_paths:
            return 0

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

        resp = self.client.models.generate_content(
            model=model,
            contents=user_msg,
            config={
                "system_instruction": system_msg,
                "temperature": 0,
            },
        )

        content = resp.text or ""
        content = content.strip()

        try:
            data = json.loads(content)
            idx = int(data.get("index", 0))
        except Exception:
            idx = 0

        return idx
