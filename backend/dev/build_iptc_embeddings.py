import json
from pathlib import Path

from typing import Dict, List, Tuple

import numpy as np
from dotenv import load_dotenv
from google.genai.types import EmbedContentConfig

from app.services.vertex_client import get_vertex_client

load_dotenv()


def load_concepts(json_path: Path) -> Dict[str, dict]:
    """
    carrega o json do iptc e retorna um dict qcode -> concept
    """
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    concept_set = data["conceptSet"]
    concepts_by_qcode = {c["qcode"]: c for c in concept_set}
    return concepts_by_qcode


def get_label(concept: dict, lang: str = "pt-BR") -> str:
    """
    pega o label em pt br ou faz fallback
    """
    labels = concept.get("prefLabel", {}) or {}
    if lang in labels:
        return labels[lang]
    if "en-GB" in labels:
        return labels["en-GB"]
    if labels:
        return next(iter(labels.values()))
    return concept.get("qcode", "<sem rotulo>")


def get_definition(concept: dict, lang: str = "pt-BR") -> str:
    """
    pega a definicao em pt br ou faz fallback
    """
    defs = concept.get("definition", {}) or {}
    if lang in defs:
        return defs[lang]
    if "en-GB" in defs:
        return defs["en-GB"]
    if defs:
        return next(iter(defs.values()))
    return ""


def build_topic_text(concept: dict) -> str:
    """
    monta o texto que sera usado para gerar o embedding do topico
    """
    label = get_label(concept)
    definition = get_definition(concept)
    if definition:
        return f"{label}. {definition}"
    return label


def generate_embeddings_for_topics(
    concepts_by_qcode: Dict[str, dict],
    model: str = "gemini-embedding-001",
    batch_size: int = 100,
) -> Tuple[List[str], np.ndarray]:
    """
    gera embeddings de todos os topicos usando a api do gemini
    retorna (lista_de_qcodes, matriz_de_embeddings)
    """
    client = get_vertex_client()

    # monta lista de qcodes e textos de forma deterministica
    qcodes_list: List[str] = sorted(concepts_by_qcode.keys())
    texts: List[str] = [build_topic_text(concepts_by_qcode[q]) for q in qcodes_list]

    n = len(texts)
    print(f"total de topicos: {n}")

    embeddings: List[List[float]] = []

    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch_texts = texts[start:end]
        print(f"gerando embeddings para indices {start}..{end - 1}")

        response = client.models.embed_content(
            model=model,
            contents=batch_texts,
            config=EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )

        for emb in response.embeddings:
            embeddings.append(emb.values)

    emb_matrix = np.array(embeddings, dtype="float32")
    print(f"matriz de embeddings criada com shape {emb_matrix.shape}")

    return qcodes_list, emb_matrix


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="gera arquivo iptc_embeddings.npz a partir do json do mediatopic"
    )
    parser.add_argument(
        "input_json",
        help="caminho para o arquivo json do mediatopic (ex: backend/cptall-pt-BR.json)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="backend/iptc_embeddings.npz",
        help="caminho do arquivo .npz de saida (padrao: backend/iptc_embeddings.npz)",
    )
    parser.add_argument(
        "--model",
        default="gemini-embedding-001",
        help="modelo de embedding do gemini (padrao: gemini-embedding-001)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="tamanho do batch para chamadas de embedding",
    )
    args = parser.parse_args()

    json_path = Path(args.input_json)
    if not json_path.exists():
        raise SystemExit(f"arquivo json nao encontrado: {json_path}")

    # carrega conceitos
    concepts_by_qcode = load_concepts(json_path)

    # gera embeddings
    qcodes_list, emb_matrix = generate_embeddings_for_topics(
        concepts_by_qcode,
        model=args.model,
        batch_size=args.batch_size,
    )

    # salva em .npz
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    np.savez_compressed(
        output_path,
        qcodes=np.array(qcodes_list),
        embeddings=emb_matrix,
    )

    print(f"arquivo de embeddings salvo em: {output_path}")


if __name__ == "__main__":
    main()
