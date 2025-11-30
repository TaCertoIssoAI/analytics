import { useState, useEffect, useMemo } from "react";
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
import { FileText, MessageSquare, AlertCircle, BarChart3, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { loadAllAnalyses, type AnalysisWithFileId } from "@/lib/loadAnalyses";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Pie, PieChart, Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

const Analytics = () => {
  const [analyses, setAnalyses] = useState<AnalysisWithFileId[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisWithFileId | null>(null);
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
      misleading: true,
      unknown: true,
    },
  });

  useEffect(() => {
    loadAllAnalyses()
      .then((data) => {
        setAnalyses(data);
      })
      .catch((error) => {
        console.error("Erro ao carregar análises:", error);
      });
  }, []);

  const getMainResult = (analysis: AnalysisWithFileId) => {
    const verdict = analysis.overall_verdict.toUpperCase();
    if (verdict === "VERDADEIRO") return "True";
    if (verdict === "FALSO") return "Fake";
    if (verdict === "ENGANOSO") return "Misleading";
    return "Fake";
  };

  // Aplica os filtros nas análises
  const filteredAnalyses = useMemo(() => {
    return analyses.filter((analysis) => {
      // Filtro de busca por texto
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const allTopics = Array.from(
          new Set(analysis.claims.flatMap(claim => claim.topics))
        );
        const matchesSearch =
          analysis.user_message_text.toLowerCase().includes(searchLower) ||
          analysis.full_combined_text.toLowerCase().includes(searchLower) ||
          allTopics.some(topic => topic.toLowerCase().includes(searchLower)) ||
          analysis.fileId.includes(searchTerm) ||
          analysis.document_id.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Filtro de tipo de mensagem
      const messageTypeMatch =
        (filters.messageType.whatsapp && analysis.source_type === "FromWhatsappGroup") ||
        (filters.messageType.direct && analysis.source_type === "FromDirectMessage");

      if (!messageTypeMatch) return false;

      // Filtro de modalidade
      const modalityMatch =
        (filters.modality.text && analysis.user_message_text) ||
        (filters.modality.audio && analysis.media_info.has_audio) ||
        (filters.modality.video && analysis.media_info.has_video) ||
        (filters.modality.image && analysis.media_info.has_image);

      if (!modalityMatch) return false;

      // Filtro de resultado
      const mainResult = getMainResult(analysis);
      const resultMatch =
        (filters.result.fake && mainResult === "Fake") ||
        (filters.result.true && mainResult === "True") ||
        (filters.result.misleading && mainResult === "Misleading") ||
        (filters.result.unknown && mainResult === "Unknown");

      return resultMatch;
    });
  }, [analyses, filters, searchTerm]);

  const totalMessages = filteredAnalyses.length;
  const totalClaims = filteredAnalyses.reduce((acc, a) => acc + a.claims.length, 0);
  const fakeCount = filteredAnalyses.reduce(
    (acc, a) =>
      acc +
      a.claims.filter((claim) => claim.verdict === "Fake").length,
    0
  );
  const fakePercentage = totalClaims > 0 ? Math.round((fakeCount / totalClaims) * 100) : 0;

  const handleRowClick = (analysis: AnalysisWithFileId) => {
    setSelectedAnalysis(analysis);
    setDialogOpen(true);
  };

  const handleSourceClick = (source: string) => {
    setSelectedSource(source);
    setSourceDialogOpen(true);
  };

  // Processar fontes e suas citações
  const sourcesData = useMemo(() => {
    const sourceMap = new Map<string, Array<{
      analysis: AnalysisWithFileId;
      claimId: string;
      claimText: string;
      result: string;
    }>>();

    filteredAnalyses.forEach((analysis) => {
      analysis.claims.forEach((claim) => {
        claim.sources.forEach((source) => {
          if (!sourceMap.has(source)) {
            sourceMap.set(source, []);
          }
          sourceMap.get(source)!.push({
            analysis,
            claimId: claim.claim_id,
            claimText: claim.text,
            result: claim.verdict,
          });
        });
      });
    });

    return Array.from(sourceMap.entries())
      .map(([source, citations]) => ({
        source,
        citations,
        count: citations.length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredAnalyses]);

  const selectedSourceData = useMemo(() => {
    if (!selectedSource) return { citations: [], totalCitations: 0 };
    const sourceData = sourcesData.find(s => s.source === selectedSource);
    return {
      citations: sourceData?.citations || [],
      totalCitations: sourceData?.count || 0,
    };
  }, [selectedSource, sourcesData]);

  // Dados para os gráficos
  const resultsChartData = useMemo(() => {
    const fakeCount = filteredAnalyses.reduce(
      (acc, a) => acc + a.claims.filter((claim) => claim.verdict === "Fake").length,
      0
    );
    const trueCount = filteredAnalyses.reduce(
      (acc, a) => acc + a.claims.filter((claim) => claim.verdict === "True").length,
      0
    );
    const misleadingCount = filteredAnalyses.reduce(
      (acc, a) => acc + a.claims.filter((claim) => claim.verdict === "Misleading").length,
      0
    );

    return [
      { name: "Falso", value: fakeCount, fill: "hsl(var(--chart-1))" },
      { name: "Verdadeiro", value: trueCount, fill: "hsl(var(--chart-2))" },
      { name: "Enganoso", value: misleadingCount, fill: "hsl(var(--chart-3))" },
    ].filter(item => item.value > 0);
  }, [filteredAnalyses]);

  const modalitiesChartData = useMemo(() => {
    return [
      {
        name: "Texto",
        value: filteredAnalyses.filter((a) => a.user_message_text).length,
        fill: "hsl(var(--chart-1))",
      },
      {
        name: "Áudio",
        value: filteredAnalyses.filter((a) => a.media_info.has_audio).length,
        fill: "hsl(var(--chart-2))",
      },
      {
        name: "Vídeo",
        value: filteredAnalyses.filter((a) => a.media_info.has_video).length,
        fill: "hsl(var(--chart-3))",
      },
      {
        name: "Imagem",
        value: filteredAnalyses.filter((a) => a.media_info.has_image).length,
        fill: "hsl(var(--chart-4))",
      },
    ].filter(item => item.value > 0);
  }, [filteredAnalyses]);

  const resultsChartConfig = {
    value: {
      label: "Quantidade",
    },
    Falso: {
      label: "Falso",
      color: "hsl(var(--chart-1))",
    },
    Verdadeiro: {
      label: "Verdadeiro",
      color: "hsl(var(--chart-2))",
    },
    Enganoso: {
      label: "Enganoso",
      color: "hsl(var(--chart-3))",
    },
  };

  const modalitiesChartConfig = {
    value: {
      label: "Análises",
    },
    Texto: {
      label: "Texto",
      color: "hsl(var(--chart-1))",
    },
    Áudio: {
      label: "Áudio",
      color: "hsl(var(--chart-2))",
    },
    Vídeo: {
      label: "Vídeo",
      color: "hsl(var(--chart-3))",
    },
    Imagem: {
      label: "Imagem",
      color: "hsl(var(--chart-4))",
    },
  };

  const resultColors = {
    Fake: "bg-status-false/10 text-status-false border-status-false/20",
    True: "bg-status-true/10 text-status-true border-status-true/20",
    Misleading: "bg-status-misleading/10 text-status-misleading border-status-misleading/20",
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
                    value={totalMessages}
                    icon={MessageSquare}
                  />
                  <MetricsCard
                    title="Total de Claims"
                    value={totalClaims}
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
                      {resultsChartData.length > 0 ? (
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
                      {modalitiesChartData.length > 0 ? (
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
                      <TableHead>Claims</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Tópicos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnalyses.map((analysis) => {
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
                          <TableCell>{analysis.claims.length}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={resultColors[getMainResult(analysis)]}
                            >
                              {getMainResult(analysis) === "Fake" && "Falso"}
                              {getMainResult(analysis) === "True" && "Verdadeiro"}
                              {getMainResult(analysis) === "Misleading" && "Enganoso"}
                            </Badge>
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
                    })}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Aba Fontes */}
              <TabsContent value="sources" className="space-y-6">
                {sourcesData.length === 0 ? (
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
                      {sourcesData.map(({ source, count }) => (
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
        fileId={selectedAnalysis?.fileId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <SourceDetailDialog
        source={selectedSource}
        citations={selectedSourceData.citations}
        totalCitations={selectedSourceData.totalCitations}
        open={sourceDialogOpen}
        onOpenChange={setSourceDialogOpen}
      />
    </div>
  );
};

export default Analytics;
