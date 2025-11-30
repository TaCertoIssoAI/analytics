import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterSection } from "@/components/FilterSection";
import { type AnalysisFilters } from "@/components/analytics/AnalysisSidebar";
import { MetricsCard } from "@/components/analytics/MetricsCard";
import { MessageDetailDialog } from "@/components/analytics/MessageDetailDialog";
import { SourceDetailDialog } from "@/components/analytics/SourceDetailDialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageSquare, ExternalLink } from "lucide-react";
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

interface DashboardData {
  total_messages: number;
  total_claims: number;
  results_distribution: Array<{ name: string; value: number }>;
  modalities_distribution: Array<{ name: string; value: number }>;
  top_sources: Array<{ source: string; count: number }>;
}

const Analytics = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<AnalysisFilters>({
    messageType: {
      whatsapp: true,
      direct: true,
    },
    modality: {
      text: true,
      audio: true,
      video: true,
      image: true,
    },
    result: {
      fake: true,
      true: true,
      unknown: true,
    },
    percentage: {
      minTruthScore: 0,
      maxTruthScore: 100,
      minFakeScore: 0,
      maxFakeScore: 100,
    },
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    if (searchTerm) params.append("search", searchTerm);

    params.append("message_type_whatsapp", String(filters.messageType.whatsapp));
    params.append("message_type_direct", String(filters.messageType.direct));

    params.append("modality_text", String(filters.modality.text));
    params.append("modality_audio", String(filters.modality.audio));
    params.append("modality_video", String(filters.modality.video));
    params.append("modality_image", String(filters.modality.image));

    params.append("result_fake", String(filters.result.fake));
    params.append("result_true", String(filters.result.true));
    params.append("result_unknown", String(filters.result.unknown));

    // Filtros de porcentagem
    params.append("min_truth_score", String(filters.percentage.minTruthScore));
    params.append("max_truth_score", String(filters.percentage.maxTruthScore));
    params.append("min_fake_score", String(filters.percentage.minFakeScore));
    params.append("max_fake_score", String(filters.percentage.maxFakeScore));

    return params;
  }, [filters, searchTerm]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams();
      
      // Fetch Dashboard Data
      const dashboardRes = await fetch(`${apiUrl}/analises/dashboard?${params.toString()}`);
      if (dashboardRes.ok) {
        const result = await dashboardRes.json();
        if (result.success) {
          setDashboardData(result.data);
        }
      }

      // Fetch List Data (Limit 50 for now)
      params.append("limit", "50");
      const listRes = await fetch(`${apiUrl}/analises?${params.toString()}`);
      if (listRes.ok) {
        const result = await listRes.json();
        if (result.success) {
          setAnalyses(result.data.items);
        }
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, buildQueryParams]);

  useEffect(() => {
    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fetchData]);

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

  const resultsChartConfig = {
    value: { label: "Quantidade" },
    Falso: { label: "Falso", color: "hsl(var(--chart-1))" },
    Verdadeiro: { label: "Verdadeiro", color: "hsl(var(--chart-2))" },
    Desconhecido: { label: "Desconhecido", color: "hsl(var(--chart-3))" },
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
          <h1 className="text-4xl font-bold">Analytics Dashboard</h1>
        </div>

        {/* Filtros */}
        <div className="mb-8">
          <FilterSection
            filters={filters}
            onFilterChange={setFilters}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
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
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricsCard
                    title="Total de Mensagens"
                    value={dashboardData?.total_messages || 0}
                    icon={MessageSquare}
                  />
                  <MetricsCard
                    title="Total de Claims"
                    value={dashboardData?.total_claims || 0}
                    icon={FileText}
                  />
                </div>

                {/* Gráficos */}
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                  {/* Gráfico de Resultados */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição de Resultados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          Carregando...
                        </div>
                      ) : resultsChartData.length > 0 ? (
                        <ChartContainer config={resultsChartConfig} className="h-[250px]">
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={resultsChartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              label
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponível
                        </div>
                      )}
                    </CardContent>
                  </Card>

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
                        <ChartContainer config={modalitiesChartConfig} className="h-[250px]">
                          <BarChart data={modalitiesChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Claims</TableHead>
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
                                  {analysis.analysis_metrics.unverified_count > 0 && (
                                    <div
                                      className="h-3 w-3 rounded-full bg-status-unverifiable"
                                      title={`Não Verificável: ${analysis.analysis_metrics.unverified_score}%`}
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
                                  {getMainResult(analysis) === "Unknown" && "Desconhecido"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {allTopics.slice(0, 2).map((topic) => (
                                  <Badge key={topic} variant="secondary" className="text-xs">
                                    {topic}
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
              </TabsContent>

              {/* Aba Fontes */}
              <TabsContent value="sources" className="space-y-6">
                {loading ? (
                   <div className="text-center py-12 text-muted-foreground">
                     Carregando fontes...
                   </div>
                ) : !dashboardData?.top_sources || dashboardData.top_sources.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ExternalLink className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma fonte encontrada com os filtros atuais</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fonte</TableHead>
                        <TableHead className="text-right">Citações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.top_sources.map(({ source, count }) => (
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

export default Analytics;
