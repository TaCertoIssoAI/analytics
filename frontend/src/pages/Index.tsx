import { Header } from "@/components/Header";
import { VerificationCard } from "@/components/VerificationCard";
import { Button } from "@/components/ui/button";
import { Database, FileText, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadAllAnalyses, getAnalysisStatus, formatDate, type AnalysisWithFileId } from "@/lib/loadAnalyses";

const Index = () => {
  const [analyses, setAnalyses] = useState<AnalysisWithFileId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllAnalyses()
      .then((data) => {
        setAnalyses(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Erro ao carregar análises:", error);
        setLoading(false);
      });
  }, []);

  // Converte análises para o formato esperado pelo VerificationCard
  const verifications = analyses.map((analysis) => {
    const allTopics = Array.from(
      new Set(analysis.claims.flatMap(claim => claim.topics))
    );
    return {
      id: analysis.fileId, // Usa o fileId (001, 002, etc.) para as rotas
      title: analysis.user_message_text.substring(0, 100) + (analysis.user_message_text.length > 100 ? '...' : ''),
      status: getAnalysisStatus(analysis),
      date: formatDate(analysis.processed_at),
      tags: allTopics,
      excerpt: analysis.final_comment,
    };
  });

  // Calcula estatísticas
  const totalClaims = analyses.reduce((acc, a) => acc + a.claims.length, 0);
  const fakeCount = analyses.reduce(
    (acc, a) =>
      acc + a.claims.filter((claim) => claim.verdict === "Fake").length,
    0
  );
  const fakePercentage = totalClaims > 0 ? Math.round((fakeCount / totalClaims) * 100) : 0;

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
                {loading ? "..." : analyses.length.toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground">Verificações Realizadas</div>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-bold">
                {loading ? "..." : totalClaims.toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground">Afirmações Analisadas</div>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-bold">
                {loading ? "..." : `${fakePercentage}%`}
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

            <div className="mt-8 text-center">
              <Button variant="outline" size="lg">
                Carregar Mais Verificações
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Index;
