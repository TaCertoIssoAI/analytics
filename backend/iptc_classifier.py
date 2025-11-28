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
    # pega o rótulo em pt-br ou fallback
    labels = concept.get("prefLabel", {}) or {}
    if lang in labels:
        return labels[lang]
    if "en-GB" in labels:
        return labels["en-GB"]
    if labels:
        return next(iter(labels.values()))
    return concept.get("qcode", "<sem rotulo>")


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

        # cliente da openai para embedar claims
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
        delta_min: float = 0.01,
        max_depth: int = 5,
    ) -> list[dict]:
        # faz embedding do claim
        claim_vec = self.embed_claim(text)

        path = []

        # 1. escolhe melhor raiz
        root_sims = self._cosine_for_qcodes(claim_vec, self.roots)
        if not root_sims:
            return []

        current_q = max(root_sims, key=root_sims.get)
        current_sim = root_sims[current_q]

        path.append(self._node_info(current_q, current_sim))

        # 2. desce na arvore
        while self.level.get(current_q, 1) < max_depth:
            child_qs = self.children.get(current_q, [])
            if not child_qs:
                break

            child_sims = self._cosine_for_qcodes(claim_vec, child_qs)
            if not child_sims:
                break

            best_child_q = max(child_sims, key=child_sims.get)
            best_child_sim = child_sims[best_child_q]

            # se o filho nao melhora a similaridade o suficiente, para
            if best_child_sim < current_sim + delta_min:
                break

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
