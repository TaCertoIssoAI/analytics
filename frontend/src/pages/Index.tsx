import { Header } from "@/components/Header";
import { VerificationCard } from "@/components/VerificationCard";
import { Button } from "@/components/ui/button";
import { Database, FileText, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/loadAnalyses";
import type { Analysis } from "@/types/analysis";

interface Stats {
  total_verificacoes: number;
  total_afirmacoes: number;
  percentual_falso: number;
}

const Index = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 9; // 3x3 grid

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Carrega estatísticas
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`${apiUrl}/analises/stats`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setStats(result.data);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      }
    };
    loadStats();
  }, [apiUrl]);

  // Carrega análises (verificações recentes)
  useEffect(() => {
    loadAnalyses(0);
  }, [apiUrl]);

  const loadAnalyses = async (currentOffset: number) => {
    const isLoadingMore = currentOffset > 0;
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(`${apiUrl}/analises?limit=${LIMIT}&offset=${currentOffset}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const newAnalyses = result.data.items;

          if (isLoadingMore) {
            setAnalyses(prev => [...prev, ...newAnalyses]);
          } else {
            setAnalyses(newAnalyses);
          }

          setHasMore(result.data.has_more);
          setOffset(currentOffset + newAnalyses.length);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar análises:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    loadAnalyses(offset);
  };

  // Converte análises para o formato esperado pelo VerificationCard
  const verifications = analyses.map((analysis) => {
    const allTopics = Array.from(
      new Set(analysis.claims.flatMap(claim => claim.topics))
    );

    // Determina status baseado no overall_verdict
    let status: 'true' | 'false' | 'unverifiable' = 'unverifiable';
    const verdict = analysis.overall_verdict.toUpperCase();
    if (verdict === 'VERDADEIRO') status = 'true';
    else if (verdict === 'FALSO') status = 'false';

    return {
      id: analysis.document_id,
      title: analysis.analysis_title || (analysis.user_message_text?.substring(0, 100) + (analysis.user_message_text && analysis.user_message_text.length > 100 ? '...' : '')),
      status,
      date: formatDate(analysis.processed_at),
      tags: allTopics.slice(0, 3), // Limita a 3 tags para não poluir
      excerpt: analysis.final_comment,
      analysis_metrics: analysis.analysis_metrics,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="border-b border-border bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Combatendo Desinformação com{" "}
              <span className="text-primary">Inteligência Artificial</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Plataforma de analytics para pesquisadores e jornalistas acessarem dados de verificações de fact-checking realizadas pelo nosso bot de WhatsApp.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button size="lg" className="gap-2" asChild>
                <Link to="/analytics">
                  <Database className="h-5 w-5" />
                  Explorar Dados
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <Link to="/sobre">
                  Sobre o Projeto
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            <div className="bg-card rounded-lg border p-6 text-center">
              <Database className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-bold">
                {!stats ? "..." : stats.total_verificacoes.toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground">Verificações Realizadas</div>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-bold">
                {!stats ? "..." : stats.total_afirmacoes.toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground">Afirmações Analisadas</div>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-bold">
                {!stats ? "..." : `${stats.percentual_falso}%`}
              </div>
              <div className="text-sm text-muted-foreground">Conteúdo Falso Detectado</div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="container py-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Verificações Recentes</h2>
          <p className="text-muted-foreground">
            Explore as verificações mais recentes realizadas pela nossa IA
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando verificações...</p>
          </div>
        ) : verifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma verificação encontrada.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {verifications.map((verification) => (
                <VerificationCard key={verification.id} {...verification} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Carregando..." : "Carregar Mais Verificações"}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Index;
