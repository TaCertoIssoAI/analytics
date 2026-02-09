import { Header } from "@/components/Header";
import { VerificationCard, Tag } from "@/components/VerificationCard";
import { Button } from "@/components/ui/button";
import { Database, Trophy, BadgeCheck, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTopReviewers, TopReviewersResponse } from "@/auth/userService";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/loadAnalyses";
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
      <section className="border-b border-border bg-gradient-to-br from-background via-muted/30 to-background overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        
        <div className="container py-16 md:py-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column: Text & Stats */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  Combatendo Desinformação com{" "}
                  <span className="text-primary">Inteligência Artificial</span>
                </h1>
                <p className="text-lg text-muted-foreground">
                  Plataforma de analytics para pesquisadores e jornalistas acessarem dados de verificações de fact-checking realizadas pelo nosso bot de WhatsApp.
                </p>
                <div className="flex flex-wrap gap-4 justify-center pt-4">
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
              </div>

              {/* Mini Stats Grid */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {!stats ? "..." : stats.total_verificacoes.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Verificações</div>
                </div>
                <div className="text-center border-l border-r">
                  <div className="text-2xl font-bold text-primary">
                    {!stats ? "..." : stats.total_afirmacoes.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Afirmações</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {!stats ? "..." : `${stats.percentual_falso}%`}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Fake News</div>
                </div>
              </div>
            </div>

            {/* Right Column: Top Reviewers */}
            <div className="lg:pl-12">
              <div className="bg-card/50 backdrop-blur-sm border rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {topReviewersData.period === 'week' ? 'Top Revisores da Semana' : 'Top Revisores de Todos os Tempos'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {topReviewersData.period === 'week' ? 'Quem mais contribuiu esta semana' : 'Os maiores contribuidores da plataforma'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {topReviewersData.reviewers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando ranking...
                    </div>
                  ) : (
                    topReviewersData.reviewers.map((reviewer, index) => (
                      <Link 
                        key={reviewer.user.uid} 
                        to={`/perfil/${reviewer.user.uid}`}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex-shrink-0 font-bold text-muted-foreground w-6 text-center">
                          #{index + 1}
                        </div>
                        
                        <div className="relative">
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            <AvatarImage src={reviewer.user.photoURL} alt={reviewer.user.displayName || "User"} />
                            <AvatarFallback>{reviewer.user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {index < 3 && (
                            <div className="absolute -top-1 -right-1 bg-yellow-400 text-[10px] font-bold text-yellow-950 px-1 rounded-full shadow-sm border border-white">
                              {index + 1}º
                            </div>
                          )}
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
                
                <div className="mt-6 pt-4 border-t text-center">
                  <Link to="/seja-um-revisor" className="text-sm text-primary hover:underline font-medium">
                    Junte-se aos revisores ⮕
                  </Link>
                </div>
              </div>
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