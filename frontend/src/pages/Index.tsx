import { Header } from "@/components/Header";
import { VerificationCard, Tag } from "@/components/VerificationCard";
import { Button } from "@/components/ui/button";
import { Database, Trophy, BadgeCheck, RefreshCw, Heart, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTopReviewers, TopReviewersResponse } from "@/auth/userService";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/loadAnalyses";
import { getValidPhotoUrl } from "@/lib/utils";
import type { Analysis } from "@/types/analysis";
import iptcMapping from "@/data/iptcMapping.json";
import { useCachedData } from "@/hooks/useCachedData";
import { useSplash } from "@/context/SplashContext";

interface Stats {
  total_verificacoes: number;
  total_afirmacoes: number;
  percentual_falso: number;
}

interface AnalysesResponse {
  items: Analysis[];
  has_more: boolean;
}

const Index = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const LIMIT = 9; // 3x3 grid

  // --- Caching Strategies ---

  // 1. Stats Caching
  const fetchStats = useCallback(async () => {
    const response = await fetch(`${apiUrl}/analises/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    const result = await response.json();
    return result.success && result.data ? result.data : null;
  }, [apiUrl]);

  const { data: stats } = useCachedData<Stats | null>(
    'tacerto-stats',
    fetchStats,
    null
  );

  // 2. Top Reviewers Caching
  const fetchTopReviewers = useCallback(async () => {
    return await getTopReviewers();
  }, []);

  const { data: topReviewersData } = useCachedData<TopReviewersResponse>(
    'tacerto-top-reviewers',
    fetchTopReviewers,
    { reviewers: [], period: 'week' }
  );

  // 3. Recent Verifications Caching (Initial Load Only)
  const fetchInitialAnalyses = useCallback(async () => {
    const response = await fetch(`${apiUrl}/analises?limit=${LIMIT}&offset=0`);
    if (!response.ok) throw new Error('Failed to fetch analyses');
    const result = await response.json();
    return result.success && result.data ? result.data : { items: [], has_more: false };
  }, [apiUrl]);

  const { 
    data: initialAnalysesData, 
    loading: initialLoading,
    refetch: refetchAnalyses,
    isRefetching: isRefetchingAnalyses
  } = useCachedData<AnalysesResponse>(
    'tacerto-recent-verifications',
    fetchInitialAnalyses,
    { items: [], has_more: false }
  );

  // --- State Management for Pagination ---
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const { addTask, removeTask } = useSplash();

  // Register splash task for initial data load
  useEffect(() => {
    addTask('home-data');
    
    if (!initialLoading) {
        removeTask('home-data');
    }

    return () => {
        // Cleanup in case component unmounts
        removeTask('home-data');
    };
  }, [addTask, removeTask, initialLoading]);

  // Sync cached initial data with local state when it changes (or on mount)
  useEffect(() => {
    if (initialAnalysesData.items.length > 0) {
      // Only set if we haven't loaded more data yet (offset is 0 or initial)
      if (offset === 0) {
        setAnalyses(initialAnalysesData.items);
        setHasMore(initialAnalysesData.has_more);
        setOffset(initialAnalysesData.items.length);
      }
    }
  }, [initialAnalysesData]);

  // Load More Functionality (Pagination - Not Cached)
  const loadMoreAnalyses = async () => {
    setLoadingMore(true);
    try {
      const response = await fetch(`${apiUrl}/analises?limit=${LIMIT}&offset=${offset}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const newAnalyses = result.data.items;
          setAnalyses(prev => [...prev, ...newAnalyses]);
          setHasMore(result.data.has_more);
          setOffset(prev => prev + newAnalyses.length);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar mais análises:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Converte análises para o formato esperado pelo VerificationCard
  const verifications = analyses.map((analysis) => {
    const allTopics: Tag[] = Array.from(
      new Set(analysis.claims.flatMap(claim => claim.topics))
    ).map(topicStr => {
      const parts = topicStr.split('|');
      let name = parts[0];
      let id = parts.length > 1 ? parts[1] : undefined;

      if (!id) {
        const lowerName = name.toLowerCase();
        // @ts-ignore
        if (iptcMapping[lowerName]) {
           // @ts-ignore
          id = iptcMapping[lowerName];
        }
      }

      if (id) {
        return { name, id };
      }
      return { name };
    });

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
      <section className="bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container pt-10 md:pt-14 pb-6 md:pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
              Analytics contra desinformação
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight max-w-3xl">
            Combatendo desinformação com <span className="text-primary">inteligência artificial</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-3xl">
            Plataforma de analytics para pesquisadores e jornalistas acessarem dados de verificações
            de fact-checking realizadas pelo nosso bot de WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/busca">
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

          <div className="mt-8 grid max-w-3xl grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3">
            <div className="min-w-0">
              <div className="text-2xl font-bold text-primary">
                {!stats ? "..." : stats.total_verificacoes.toLocaleString('pt-BR')}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Verificações</div>
            </div>
            <div className="min-w-0 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <div className="text-2xl font-bold text-primary">
                {!stats ? "..." : stats.total_afirmacoes.toLocaleString('pt-BR')}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Afirmações</div>
            </div>
            <div className="min-w-0 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <div className="text-2xl font-bold text-primary">
                {!stats ? "..." : `${stats.percentual_falso}%`}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Fake News</div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Reviewers */}
      <section className="container pt-8 pb-12">
        <div className="rounded-lg border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">
                  {topReviewersData.period === 'week' ? 'Top Revisores da Semana' : 'Top Revisores de Todos os Tempos'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {topReviewersData.period === 'week' ? 'Quem mais contribuiu esta semana' : 'Os maiores contribuidores da plataforma'}
                </p>
              </div>
            </div>
            <Link to="/seja-um-revisor" className="text-sm text-primary hover:underline font-medium">
              Junte-se aos revisores
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {topReviewersData.reviewers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground lg:col-span-3">
                Carregando ranking...
              </div>
            ) : (
              topReviewersData.reviewers.slice(0, 3).map((reviewer, index) => (
                <Link 
                  key={reviewer.user.uid} 
                  to={`/perfil/${reviewer.user.uid}`}
                  className="flex items-center gap-4 rounded-md border bg-background p-3 transition-colors hover:bg-accent/50 group"
                >
                  <div className="flex-shrink-0 font-bold text-muted-foreground w-6 text-center">
                    #{index + 1}
                  </div>
                  
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                      <AvatarImage src={getValidPhotoUrl(reviewer.user.photoURL)} alt={reviewer.user.displayName || "User"} />
                      <AvatarFallback>{reviewer.user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-1 -right-1 bg-yellow-400 text-[10px] font-bold text-yellow-950 px-1 rounded-full shadow-sm border border-white">
                      {index + 1}º
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold truncate group-hover:text-primary transition-colors">
                        {reviewer.user.displayName}
                      </span>
                      <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {reviewer.user.occupation || "Membro da comunidade"}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-primary">{reviewer.count}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Avaliações</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Support / Vaquinha CTA */}
      <section className="border-y border-border bg-primary/5">
        <div className="container py-10 md:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <Heart className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wider font-semibold">
                  Ajude a manter o projeto no ar
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Apoie o Tá Certo Isso AI? rumo às eleições de 2026
              </h2>
              <p className="text-muted-foreground mt-2">
                Funcionamos de forma independente. Sua contribuição via Pix mantém a operação viva
                e nos ajuda a escalar o compromisso com a verdade num ano decisivo para o Brasil.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:flex-shrink-0">
              <Button size="lg" className="gap-2" asChild>
                <Link to="/apoie">
                  <Heart className="h-5 w-5" />
                  Apoiar agora
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <Link to="/apoie?tab=transparencia">
                  <ShieldCheck className="h-5 w-5" />
                  Ver transparência
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="container py-16">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              Verificações Recentes
              {isRefetchingAnalyses && (
                 <span className="text-xs font-normal text-muted-foreground animate-pulse">Atualizando...</span>
              )}
            </h2>
            <p className="text-muted-foreground">
              Explore as verificações mais recentes realizadas pela nossa IA
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchAnalyses()}
            disabled={isRefetchingAnalyses}
            className="self-start md:self-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetchingAnalyses ? 'animate-spin' : ''}`} />
            Atualizar Verificações
          </Button>
        </div>

        {initialLoading && verifications.length === 0 ? (
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
                  onClick={loadMoreAnalyses}
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
