from iptc_classifier import IptcEmbeddingTree


def main():
    tree = IptcEmbeddingTree(
        json_path="cptall-pt-BR.json",
        embeddings_path="iptc_embeddings.npz",
    )

    claim = "Presidente anuncia novo programa de auxílio financeiro de R$ 1.500"
    results = tree.classify_claim(
        claim,
        max_depth=5,
        top_k_roots=3,
        rerank_with_llm=True,  # aqui entra a magia
        llm_model="gpt-4.1-mini",
    )

    print("caminhos de classificacao (primeiro = escolhido pela llm):")
    for i, item in enumerate(results, start=1):
        print(f"\n> caminho {i} | score heuristico={item['score']:.3f}")
        for node in item["nodes"]:
            print(
                f"  nivel {node['level']} | {node['qcode']} | "
                f"{node['name']} | sim={node['similarity']:.3f}"
            )


if __name__ == "__main__":
    main()
