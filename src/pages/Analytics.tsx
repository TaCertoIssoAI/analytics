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
import { FileText, MessageSquare, AlertCircle, BarChart3, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { loadAllAnalyses, type AnalysisWithFileId } from "@/lib/loadAnalyses";

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
    const results = Object.values(analysis.ResponseByClaim).map((r) => r.Result);
    const fakeCount = results.filter((r) => r === "Fake").length;
    const trueCount = results.filter((r) => r === "True").length;
    if (fakeCount > trueCount) return "Fake";
    if (trueCount > fakeCount) return "True";
    return "Misleading";
  };

  // Aplica os filtros nas análises
  const filteredAnalyses = useMemo(() => {
    return analyses.filter((analysis) => {
      // Filtro de busca por texto
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          analysis.PureText.toLowerCase().includes(searchLower) ||
          analysis.FinalTranscribedText.toLowerCase().includes(searchLower) ||
          analysis.Topics.some(topic => topic.toLowerCase().includes(searchLower)) ||
          analysis.fileId.includes(searchTerm) ||
          analysis.DocumentId.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Filtro de tipo de mensagem
      const messageTypeMatch =
        (filters.messageType.whatsapp && analysis.MessageType === "FromWhatsappGroup") ||
        (filters.messageType.direct && analysis.MessageType === "FromDirectMessage");

      if (!messageTypeMatch) return false;

      // Filtro de modalidade
      const modalityMatch =
        (filters.modality.text && analysis.PureText) ||
        (filters.modality.audio && analysis.HadAudio) ||
        (filters.modality.video && analysis.HadVideo) ||
        (filters.modality.image && analysis.HadImage);

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
  const totalClaims = filteredAnalyses.reduce((acc, a) => acc + Object.keys(a.Claims).length, 0);
  const fakeCount = filteredAnalyses.reduce(
    (acc, a) =>
      acc +
      Object.values(a.ResponseByClaim).filter((r) => r.Result === "Fake").length,
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
      Object.entries(analysis.ResponseByClaim).forEach(([claimId, response]) => {
        response.reasoningSources.forEach((source) => {
          if (!sourceMap.has(source)) {
            sourceMap.set(source, []);
          }
          sourceMap.get(source)!.push({
            analysis,
            claimId,
            claimText: analysis.Claims[claimId].text,
            result: response.Result,
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  <MetricsCard
                    title="Fake News"
                    value={`${fakePercentage}%`}
                    icon={AlertCircle}
                    description={`${fakeCount} de ${totalClaims} claims`}
                  />
                </div>

                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Gráficos em desenvolvimento</p>
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
                    {filteredAnalyses.map((analysis) => (
                      <TableRow
                        key={analysis.DocumentId}
                        className="cursor-pointer"
                        onClick={() => handleRowClick(analysis)}
                      >
                        <TableCell>
                          {format(new Date(analysis.Date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {analysis.MessageType === "FromWhatsappGroup"
                            ? "WhatsApp"
                            : "Direta"}
                        </TableCell>
                        <TableCell>{Object.keys(analysis.Claims).length}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={resultColors[getMainResult(analysis)]}
                          >
                            {getMainResult(analysis) === "Fake" ? "Falso" : "Verdadeiro"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {analysis.Topics.slice(0, 2).map((topic) => (
                              <Badge key={topic} variant="secondary" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                            {analysis.Topics.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{analysis.Topics.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
