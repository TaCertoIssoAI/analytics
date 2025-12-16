import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecommendedAnalysis {
  document_id: string;
  analysis_title: string;
  overall_verdict: string;
  processed_at: string;
  analysis_metrics: {
    total_claims: number;
    true_count: number;
    fake_count: number;
    out_of_context_count: number;
    unverified_count: number;
  };
}

interface RecommendationsSectionProps {
  documentId: string;
}

export const RecommendationsSection = ({ documentId }: RecommendationsSectionProps) => {
  const [recommendations, setRecommendations] = useState<RecommendedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/analises/${documentId}/recommendations?limit=9`);

        if (!response.ok) {
          throw new Error("Failed to fetch recommendations");
        }

        const result = await response.json();

        if (result.success && result.data?.items) {
          setRecommendations(result.data.items);
        }
      } catch (err) {
        console.error("Erro ao carregar recomendações:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    // Carrega em background após um pequeno delay para não competir com o carregamento principal
    const timer = setTimeout(() => {
      loadRecommendations();
    }, 500);

    return () => clearTimeout(timer);
  }, [documentId]);

  if (loading) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Verificações Similares</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Não mostra nada se houver erro ou não houver recomendações
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Verificações Similares</h2>
      <p className="text-muted-foreground mb-6">
        Baseado na classificação das categorias do IPTC das afirmações verificadas:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec) => {
          return (
            <Link
              key={rec.document_id}
              to={`/verificacao/${rec.document_id}`}
              className="block transition-transform hover:scale-105"
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <h3 className="text-sm font-semibold line-clamp-3 leading-tight">
                    {rec.analysis_title || "Análise sem título"}
                  </h3>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-muted-foreground mb-3">
                    {format(new Date(rec.processed_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  
                  {rec.analysis_metrics && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span>{rec.analysis_metrics.total_claims} afirmações</span>
                      {rec.analysis_metrics.true_count > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-status-true" />
                          {rec.analysis_metrics.true_count}
                        </span>
                      )}
                      {rec.analysis_metrics.fake_count > 0 && (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-status-false" />
                          {rec.analysis_metrics.fake_count}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
