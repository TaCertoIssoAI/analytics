import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterSection, type DateFilterValue } from "@/components/FilterSection";
import { type AnalysisFilters } from "@/components/analytics/AnalysisSidebar";
import { MetricsCard } from "@/components/analytics/MetricsCard";
import { MessageDetailDialog } from "@/components/analytics/MessageDetailDialog";
import { SourceDetailDialog } from "@/components/analytics/SourceDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageSquare, ExternalLink, Download, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Analysis } from "@/types/analysis";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Pie, PieChart, Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface DashboardData {
  total_messages: number;
  total_claims: number;
  results_distribution: Array<{ name: string; value: number }>;
  modalities_distribution: Array<{ name: string; value: number }>;
  top_sources: Array<{ source: string; count: number }>;
}

const Busca = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    mode: "last30d",
    startDate: "",
    endDate: "",
  });

  // Pagination State - Messages
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalMessages, setTotalMessages] = useState(0);

  // Pagination State - Sources
  const [sourcesPage, setSourcesPage] = useState(1);
  const [sourcesLimit] = useState(10);
  const [totalSources, setTotalSources] = useState(0);
  const [sources, setSources] = useState<Array<{ source: string; count: number }>>([]);
  const [filters, setFilters] = useState<AnalysisFilters>({
    modality: {
      text: true,
      audio: true,
      video: true,
      image: true,
    },
    percentage: {
      minTruthScore: 0,
      maxTruthScore: 100,
      minFakeScore: 0,
      maxFakeScore: 100,
      minUnverifiedScore: 0,
      maxUnverifiedScore: 100,
    },
  });

  const [exportLoading, setExportLoading] = useState<{
    dashboard: boolean;
    messages: boolean;
    sources: boolean;
  }>({
    dashboard: false,
    messages: false,
    sources: false,
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const getDateRangeIso = useCallback((): { start?: string; end?: string } => {
    const now = new Date();

    if (dateFilter.mode === "last24h") {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }

    if (dateFilter.mode === "last7d") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }

    if (dateFilter.mode === "last30d") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }

    // custom: espera YYYY-MM-DD
    const toStartOfDayIso = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toISOString();
    const toEndOfDayIso = (dateStr: string) => new Date(`${dateStr}T23:59:59.999`).toISOString();

    const start = dateFilter.startDate ? toStartOfDayIso(dateFilter.startDate) : undefined;
    const end = dateFilter.endDate ? toEndOfDayIso(dateFilter.endDate) : undefined;

    return { start, end };
  }, [dateFilter.endDate, dateFilter.mode, dateFilter.startDate]);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (searchTerm) params.append("search", searchTerm);

    params.append("modality_text", String(filters.modality.text));
    params.append("modality_audio", String(filters.modality.audio));
    params.append("modality_video", String(filters.modality.video));
    params.append("modality_image", String(filters.modality.image));

    // Filtros de porcentagem
    params.append("min_truth_score", String(filters.percentage.minTruthScore));
    params.append("max_truth_score", String(filters.percentage.maxTruthScore));
    params.append("min_fake_score", String(filters.percentage.minFakeScore));
    params.append("max_fake_score", String(filters.percentage.maxFakeScore));
    params.append("min_unverified_score", String(filters.percentage.minUnverifiedScore));
    params.append("max_unverified_score", String(filters.percentage.maxUnverifiedScore));

    // Filtro de data
    const { start, end } = getDateRangeIso();
    if (start) params.append("start_date", start);
    if (end) params.append("end_date", end);

    return params;
  }, [filters, getDateRangeIso, searchTerm]);

  const handleExportDashboard = async () => {
    setExportLoading(prev => ({ ...prev, dashboard: true }));
    try {
      const params = buildQueryParams();
      const response = await fetch(`${apiUrl}/analises/export/dashboard?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Falha ao exportar dashboard');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar dashboard:', error);
    } finally {
      setExportLoading(prev => ({ ...prev, dashboard: false }));
    }
  };

  const handleExportMessages = async () => {
    setExportLoading(prev => ({ ...prev, messages: true }));
    try {
      const params = buildQueryParams();
      const response = await fetch(`${apiUrl}/analises/export/messages?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Falha ao exportar mensagens');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mensagens_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar mensagens:', error);
    } finally {
      setExportLoading(prev => ({ ...prev, messages: false }));
    }
  };

  const handleExportSources = async () => {
    setExportLoading(prev => ({ ...prev, sources: true }));
    try {
      const params = buildQueryParams();
      const response = await fetch(`${apiUrl}/analises/export/sources?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Falha ao exportar fontes');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fontes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar fontes:', error);
    } finally {
      setExportLoading(prev => ({ ...prev, sources: false }));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams();
      
      // Fetch Dashboard Data (Stats only)
      const dashboardRes = await fetch(`${apiUrl}/analises/dashboard?${params.toString()}`);
      if (dashboardRes.ok) {
        const result = await dashboardRes.json();
        if (result.success) {
          setDashboardData(result.data);
        }
      }

      // Fetch List Data (Messages)
      const messagesParams = new URLSearchParams(params);
      messagesParams.append("limit", String(limit));
      messagesParams.append("offset", String((page - 1) * limit));
      
      const listRes = await fetch(`${apiUrl}/analises?${messagesParams.toString()}`);
      if (listRes.ok) {
        const result = await listRes.json();
        if (result.success) {
          setAnalyses(result.data.items);
          setTotalMessages(result.data.total);
        }
      }

      // Fetch Sources Data
      const sourcesParams = new URLSearchParams(params);
      sourcesParams.append("limit", String(sourcesLimit));
      sourcesParams.append("offset", String((sourcesPage - 1) * sourcesLimit));

      const sourcesRes = await fetch(`${apiUrl}/analises/sources?${sourcesParams.toString()}`);
      if (sourcesRes.ok) {
        const result = await sourcesRes.json();
        if (result.success) {
          setSources(result.data.items);
          setTotalSources(result.data.total);
        }
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, buildQueryParams, page, limit, sourcesPage, sourcesLimit]);

  useEffect(() => {
    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  useEffect(() => {
    // Quando muda qualquer filtro, volta pra primeira página
    setPage(1);
    setSourcesPage(1);
  }, [filters, searchTerm, dateFilter.mode, dateFilter.startDate, dateFilter.endDate]);

  const getMainResult = (analysis: Analysis) => {
    const verdict = analysis.overall_verdict.toUpperCase();
    if (verdict === "VERDADEIRO") return "True";
    if (verdict === "FALSO") return "Fake";
    return "Unknown";
  };

  const handleRowClick = (analysis: Analysis) => {
    setSelectedAnalysis(analysis);
    setDialogOpen(true);
  };

  const handleSourceClick = (source: string) => {
    setSelectedSource(source);
    setSourceDialogOpen(true);
  };

  // Dados para os gráficos (vindos do backend)
  const resultsChartData = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.results_distribution.map(item => ({
      ...item,
      fill: item.name === "Falso" ? "hsl(var(--chart-1))" : 
            item.name === "Verdadeiro" ? "hsl(var(--chart-2))" : 
            "hsl(var(--chart-3))"
    })).filter(item => item.value > 0);
  }, [dashboardData]);

  const modalitiesChartData = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.modalities_distribution.map((item, index) => ({
      ...item,
      fill: `hsl(var(--chart-${index + 1}))`
    })).filter(item => item.value > 0);
  }, [dashboardData]);

  const totals = useMemo(() => {
    if (!dashboardData) return { true: 0, fake: 0, unknown: 0 };
    
    let trueCount = 0;
    let fakeCount = 0;
    let unknownCount = 0;

    dashboardData.results_distribution.forEach(item => {
      if (item.name === "Verdadeiro") trueCount = item.value;
      if (item.name === "Falso") fakeCount = item.value;
      if (item.name === "Fontes insuficientes para verificar") unknownCount = item.value;
    });

    return { true: trueCount, fake: fakeCount, unknown: unknownCount };
  }, [dashboardData]);

  const resultsChartConfig = {
    value: { label: "Quantidade" },
    Falso: { label: "Falso", color: "hsl(var(--chart-1))" },
    Verdadeiro: { label: "Verdadeiro", color: "hsl(var(--chart-2))" },
    "Fontes insuficientes para verificar": { label: "Fontes insuficientes para verificar", color: "hsl(var(--chart-3))" },
  };

  const modalitiesChartConfig = {
    value: { label: "Análises" },
    Texto: { label: "Texto", color: "hsl(var(--chart-1))" },
    Áudio: { label: "Áudio", color: "hsl(var(--chart-2))" },
    Vídeo: { label: "Vídeo", color: "hsl(var(--chart-3))" },
    Imagem: { label: "Imagem", color: "hsl(var(--chart-4))" },
  };

  const resultColors = {
    Fake: "bg-status-false/10 text-status-false border-status-false/20",
    True: "bg-status-true/10 text-status-true border-status-true/20",
    Unknown: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Busca</h1>
        </div>

        {/* Filtros */}
        <div className="mb-8">
          <FilterSection
            filters={filters}
            onFilterChange={setFilters}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
          />
        </div>

        {/* Conteúdo Principal */}
        <div>
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="messages">Mensagens</TabsTrigger>
                <TabsTrigger value="sources">Fontes</TabsTrigger>
              </TabsList>

              {/* Aba Overview */}
              <TabsContent value="overview" className="space-y-6">
                {/* Botão de Exportação */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleExportDashboard}
                    disabled={exportLoading.dashboard || loading}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exportLoading.dashboard ? "Exportando..." : "Exportar CSV"}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <MetricsCard
                    title="Total de Mensagens"
                    value={dashboardData?.total_messages || 0}
                    icon={MessageSquare}
                  />
                  <MetricsCard
                    title="Total de Afirmações"
                    value={dashboardData?.total_claims || 0}
                    icon={FileText}
                  />
                  <MetricsCard
                    title="Total Verdadeiras"
                    value={totals.true}
                    icon={CheckCircle}
                    className="text-status-true"
                  />
                  <MetricsCard
                    title="Total Falsas"
                    value={totals.fake}
                    icon={XCircle}
                    className="text-status-false"
                  />
                  <MetricsCard
                    title="Total Fontes Insuficientes"
                    value={totals.unknown}
                    icon={HelpCircle}
                    className="text-status-unverifiable"
                  />
                </div>

                {/* Gráficos */}
                <div className="grid gap-6 grid-cols-1">
                  {/* Gráfico de Resultados */}
                 

                  {/* Gráfico de Modalidades */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Análises por Modalidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                         <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                           Carregando...
                         </div>
                      ) : modalitiesChartData.length > 0 ? (
                        <ChartContainer config={modalitiesChartConfig} className="h-[250px] w-full">
                          <BarChart data={modalitiesChartData} layout="vertical" margin={{ left: 0, right: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              tickLine={false}
                              axisLine={false}
                              width={60}
                            />
                            <XAxis type="number" hide />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="value" layout="vertical" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponível
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Aba Mensagens */}
              <TabsContent value="messages" className="space-y-6">
                {/* Botão de Exportação */}
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-muted-foreground">
                    {totalMessages > 0 && `${totalMessages} mensagens encontradas`}
                  </div>
                  <Button
                    onClick={handleExportMessages}
                    disabled={exportLoading.messages || loading || analyses.length === 0}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exportLoading.messages ? "Exportando..." : "Exportar Todas"}
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Afirmações</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Tópicos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Carregando mensagens...
                        </TableCell>
                      </TableRow>
                    ) : analyses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Nenhuma mensagem encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      analyses.map((analysis) => {
                        const allTopics = Array.from(
                          new Set(analysis.claims.flatMap(claim => claim.topics))
                        );
                        return (
                          <TableRow
                            key={analysis.document_id}
                            className="cursor-pointer"
                            onClick={() => handleRowClick(analysis)}
                          >
                            <TableCell>
                              {format(new Date(analysis.processed_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {analysis.source_type === "FromWhatsappGroup"
                                ? "WhatsApp"
                                : "Direta"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {analysis.analysis_title || "Sem título"}
                            </TableCell>
                            <TableCell>{analysis.claims.length}</TableCell>
                            <TableCell>
                              {analysis.analysis_metrics ? (
                                <div className="flex items-center gap-1.5">
                                  {analysis.analysis_metrics.true_count > 0 && (
                                    <div
                                      className="h-3 w-3 rounded-full bg-status-true"
                                      title={`Verdadeiro: ${analysis.analysis_metrics.truth_score}%`}
                                    />
                                  )}
                                  {analysis.analysis_metrics.fake_count > 0 && (
                                    <div
                                      className="h-3 w-3 rounded-full bg-status-false"
                                      title={`Falso: ${analysis.analysis_metrics.fake_score}%`}
                                    />
                                  )}
                                  {(analysis.analysis_metrics.out_of_context_count || 0) > 0 && (
                                    <div
                                      className="h-3 w-3 rounded-full bg-yellow-500"
                                      title={`Fora de Contexto: ${analysis.analysis_metrics.out_of_context_score || 0}%`}
                                    />
                                  )}
                                  {analysis.analysis_metrics.unverified_count > 0 && (
                                    <div
                                      className="h-3 w-3 rounded-full bg-status-unverifiable"
                                      title={`Fontes insuficientes para verificar: ${analysis.analysis_metrics.unverified_score}%`}
                                    />
                                  )}
                                </div>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={resultColors[getMainResult(analysis)]}
                                >
                                  {getMainResult(analysis) === "Fake" && "Falso"}
                                  {getMainResult(analysis) === "True" && "Verdadeiro"}
                                  {getMainResult(analysis) === "Unknown" && "Fontes insuficientes para verificar"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {allTopics.slice(0, 2).map((topic) => (
                                  <Badge key={topic} variant="secondary" className="text-xs">
                                    {topic.split('|')[0]}
                                  </Badge>
                                ))}
                                {allTopics.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{allTopics.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>


                {/* Pagination - Messages */}
                {totalMessages > limit && (
                  <Pagination className="mt-4">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (page > 1) setPage(page - 1);
                          }} 
                          className={page === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {/* Simple pagination logic: show current page */}
                      <PaginationItem>
                        <PaginationLink href="#" isActive>{page}</PaginationLink>
                      </PaginationItem>
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (page * limit < totalMessages) setPage(page + 1);
                          }}
                          className={page * limit >= totalMessages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </TabsContent>

              {/* Aba Fontes */}
              <TabsContent value="sources" className="space-y-6">
                {loading ? (
                   <div className="text-center py-12 text-muted-foreground">
                     Carregando fontes...
                   </div>
                ) : !sources || sources.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ExternalLink className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma fonte encontrada com os filtros atuais</p>
                  </div>
                ) : (
                  <>
                    {/* Botão de Exportação */}
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-sm text-muted-foreground">
                        {totalSources > 0 && `${totalSources} fontes encontradas`}
                      </div>
                      <Button
                        onClick={handleExportSources}
                        disabled={exportLoading.sources || loading}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {exportLoading.sources ? "Exportando..." : "Exportar Todas"}
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fonte</TableHead>
                          <TableHead className="text-right">Citações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sources.map(({ source, count }) => (
                          <TableRow
                            key={source}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSourceClick(source)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate max-w-xl">{source}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{count}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination - Sources */}
                    {totalSources > sourcesLimit && (
                      <Pagination className="mt-4">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                if (sourcesPage > 1) setSourcesPage(sourcesPage - 1);
                              }} 
                              className={sourcesPage === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                          
                          <PaginationItem>
                            <PaginationLink href="#" isActive>{sourcesPage}</PaginationLink>
                          </PaginationItem>
                          
                          <PaginationItem>
                            <PaginationNext 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                if (sourcesPage * sourcesLimit < totalSources) setSourcesPage(sourcesPage + 1);
                              }}
                              className={sourcesPage * sourcesLimit >= totalSources ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
        </div>
      </div>

      <MessageDetailDialog
        analysis={selectedAnalysis}
        fileId={selectedAnalysis?.document_id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <SourceDetailDialog
        source={selectedSource}
        citations={[]} // TODO: Implementar busca de citações por fonte se necessário, ou passar dados se já tivermos
        totalCitations={0} // Placeholder
        open={sourceDialogOpen}
        onOpenChange={setSourceDialogOpen}
      />
    </div>
  );
};

export default Busca;
