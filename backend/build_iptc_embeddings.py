import os
import json
from pathlib import Path
from collections import deque

import numpy as np
from openai import OpenAI


def load_taxonomy(json_path: Path):
    # carrega o json bruto do iptc mediatopic
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    concept_set = data["conceptSet"]

    # indices auxiliares
    concepts_by_uri = {c["uri"]: c for c in concept_set}
    concepts_by_qcode = {c["qcode"]: c for c in concept_set}

    # grafo: filhos e pais
    children = {c["qcode"]: [] for c in concept_set}
    parent = {}

    for c in concept_set:
        qcode = c["qcode"]
        for child_q in c.get("narrower", []):
            children.setdefault(qcode, []).append(child_q)
            parent[child_q] = qcode

    # raizes = hasTopConcept
    roots_qcodes = []
    for uri in data.get("hasTopConcept", []):
        concept = concepts_by_uri.get(uri)
        if concept:
            roots_qcodes.append(concept["qcode"])

    # calcula nivel com bfs
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

    return {
        "data": data,
        "concepts_by_qcode": concepts_by_qcode,
        "children": children,
        "parent": parent,
        "level": level,
        "roots": roots_qcodes,
    }


def get_label(concept: dict, lang: str = "pt-BR") -> str:
    # pega o label em pt-br, ou en-gb, ou qualquer um disponivel
    labels = concept.get("prefLabel", {}) or {}
    if lang in labels:
        return labels[lang]
    if "en-GB" in labels:
        return labels["en-GB"]
    if labels:
        return next(iter(labels.values()))
    return concept.get("qcode", "<sem rotulo>")


def get_definition(concept: dict, lang: str = "pt-BR") -> str:
    # pega definicao em pt-br, ou en-gb, ou qualquer uma
    defs = concept.get("definition", {}) or {}
    if lang in defs:
        return defs[lang]
    if "en-GB" in defs:
        return defs["en-GB"]
    if defs:
        return next(iter(defs.values()))
    return ""


def build_topic_text(concept: dict) -> str:
    # monta o texto usado para embedding: rotulo + definicao
    label = get_label(concept)
    definition = get_definition(concept)
    if definition:
        return f"{label}. {definition}"
    return label


def generate_embeddings_for_topics(
    concepts_by_qcode: dict,
    model: str = "text-embedding-3-small",
    batch_size: int = 256,
):
    # cria cliente da openai (usa variavel de ambiente OPENAI_API_KEY)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("defina a variavel de ambiente OPENAI_API_KEY com sua chave da openai")

    client = OpenAI(api_key=api_key)

    # prepara lista de qcodes e textos
    qcodes_list = []
    texts = []
    for qcode, concept in concepts_by_qcode.items():
        qcodes_list.append(qcode)
        texts.append(build_topic_text(concept))

    n = len(texts)
    print(f"total de topicos: {n}")

    embeddings = []

    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch_texts = texts[start:end]
        print(f"gerando embeddings {start}..{end - 1}")

        response = client.embeddings.create(
            model=model,
            input=batch_texts,
        )

        # cada item em response.data corresponde a um texto do batch
        for item in response.data:
            embeddings.append(item.embedding)

    emb_matrix = np.array(embeddings, dtype="float32")
    print(f"matriz de embeddings: shape = {emb_matrix.shape}")

    return qcodes_list, emb_matrix


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="gera embeddings para iptc mediatopic usando openai"
    )
    parser.add_argument(
        "input_json",
        help="caminho para o arquivo json do mediatopic (ex: mediatopic-pt-BR.json)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="iptc_embeddings.npz",
        help="arquivo .npz de saida (padrao: iptc_embeddings.npz)",
    )
    parser.add_argument(
        "--model",
        default="text-embedding-3-small",
        help="modelo de embedding da openai (padrao: text-embedding-3-small)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=256,
        help="tamanho do batch para chamadas de embedding",
    )
    args = parser.parse_args()

    json_path = Path(args.input_json)
    if not json_path.exists():
        raise SystemExit(f"arquivo nao encontrado: {json_path}")

    taxonomy = load_taxonomy(json_path)
    concepts_by_qcode = taxonomy["concepts_by_qcode"]

    qcodes_list, emb_matrix = generate_embeddings_for_topics(
        concepts_by_qcode,
        model=args.model,
        batch_size=args.batch_size,
    )

    # salva qcodes e embeddings em um .npz
    np.savez_compressed(
        args.output,
        qcodes=np.array(qcodes_list),
        embeddings=emb_matrix,
    )

    print(f"embeddings salvos em {args.output}")


if __name__ == "__main__":
    main()
