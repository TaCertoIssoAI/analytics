from iptc_classifier import IptcEmbeddingTree


def main():
    tree = IptcEmbeddingTree(
        json_path="cptall-pt-BR.json",
        embeddings_path="iptc_embeddings.npz",
    )

    claim = "Presidente anuncia novo programa de auxílio financeiro de R$ 1.500"
    path = tree.classify_claim(claim)

    print("caminho de classificacao:")
    for node in path:
        print(
            f"nivel {node['level']} | {node['qcode']} | {node['name']} | sim={node['similarity']:.3f}"
        )


if __name__ == "__main__":
    main()
