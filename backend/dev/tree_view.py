import json
from pathlib import Path
from collections import deque


def load_taxonomy(json_path: Path):
    # carrega o json bruto
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    concept_set = data["conceptSet"]

    # índice por uri e por qcode
    concepts_by_uri = {c["uri"]: c for c in concept_set}
    concepts_by_qcode = {c["qcode"]: c for c in concept_set}

    # monta filhos e pais usando o campo narrower
    children = {c["qcode"]: [] for c in concept_set}
    parent = {}

    for c in concept_set:
        qcode = c["qcode"]
        for child_q in c.get("narrower", []):
            children.setdefault(qcode, []).append(child_q)
            parent[child_q] = qcode

    # raízes são os hasTopConcept
    roots_qcodes = []
    for uri in data.get("hasTopConcept", []):
        concept = concepts_by_uri.get(uri)
        if concept:
            roots_qcodes.append(concept["qcode"])

    # calcula nível de cada nó com bfs
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
    # pega o label em pt-BR, se não tiver cai para en-GB, se não qualquer um
    labels = concept.get("prefLabel", {}) or {}
    if lang in labels:
        return labels[lang]
    if "en-GB" in labels:
        return labels["en-GB"]
    if labels:
        return next(iter(labels.values()))
    return concept.get("qcode", "<sem rotulo>")


def print_tree(
    fh,
    qcode: str,
    concepts_by_qcode: dict,
    children: dict,
    level: dict,
    depth: int = 0,
    visited: set | None = None,
):
    # imprime uma subarvore a partir de um qcode, com indentacao
    if visited is None:
        visited = set()

    indent = "  " * depth
    concept = concepts_by_qcode.get(qcode)

    if concept is None:
        fh.write(f"{indent}[{qcode}] (conceito nao encontrado)\n")
        return

    label = get_label(concept)
    lvl = level.get(qcode, "?")
    fh.write(f"{indent}[{qcode}] (nivel {lvl}) {label}\n")

    if qcode in visited:
        fh.write(f"{indent}  ... ciclo detectado, parando aqui\n")
        return

    visited.add(qcode)

    # ordena filhos pelo label para ficar legivel
    child_qcodes = children.get(qcode, [])
    child_qcodes_sorted = sorted(
        child_qcodes,
        key=lambda qc: get_label(concepts_by_qcode.get(qc, {})).lower(),
    )

    for child_q in child_qcodes_sorted:
        print_tree(
            fh,
            child_q,
            concepts_by_qcode,
            children,
            level,
            depth=depth + 1,
            visited=visited,
        )


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="gera arvore de topicos IPTC MediaTopics a partir do json"
    )
    parser.add_argument(
        "input_json",
        help="caminho para o arquivo json do mediatopic (ex: mediatopic-pt-BR.json)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="mediatopic_tree.txt",
        help="arquivo de saida com a arvore (padrao: mediatopic_tree.txt)",
    )
    args = parser.parse_args()

    json_path = Path(args.input_json)
    if not json_path.exists():
        raise SystemExit(f"arquivo nao encontrado: {json_path}")

    tax = load_taxonomy(json_path)

    concepts_by_qcode = tax["concepts_by_qcode"]
    children = tax["children"]
    level = tax["level"]
    roots = tax["roots"]

    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(f"total de conceitos: {len(concepts_by_qcode)}\n")
        fh.write(f"total de raizes: {len(roots)}\n\n")

        for root_q in roots:
            fh.write("# raiz\n")
            print_tree(fh, root_q, concepts_by_qcode, children, level, depth=0, visited=set())
            fh.write("\n")

    print(f"arvore escrita em {args.output}")


if __name__ == "__main__":
    main()
