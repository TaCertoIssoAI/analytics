import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisSidebar } from "@/components/analytics/AnalysisSidebar";
import { MetricsCard } from "@/components/analytics/MetricsCard";
import { MessageDetailDialog } from "@/components/analytics/MessageDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, MessageSquare, AlertCircle, BarChart3, Download, Search } from "lucide-react";
import { Analysis } from "@/types/analysis";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Analytics = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Carregar análises de exemplo
    const loadAnalyses = async () => {
      try {
        const responses = await Promise.all([
          fetch("/analises/001.json"),
          fetch("/analises/002.json"),
        ]);
        const data = await Promise.all(responses.map((r) => r.json()));
        setAnalyses(data);
      } catch (error) {
        console.error("Erro ao carregar análises:", error);
      }
    };
    loadAnalyses();
  }, []);

  const totalMessages = analyses.length;
  const totalClaims = analyses.reduce((acc, a) => acc + Object.keys(a.Claims).length, 0);
  const fakeCount = analyses.reduce(
    (acc, a) =>
      acc +
      Object.values(a.ResponseByClaim).filter((r) => r.Result === "Fake").length,
    0
  );
  const fakePercentage = totalClaims > 0 ? Math.round((fakeCount / totalClaims) * 100) : 0;

  const handleRowClick = (analysis: Analysis) => {
    setSelectedAnalysis(analysis);
    setDialogOpen(true);
  };

  const getMainResult = (analysis: Analysis) => {
    const results = Object.values(analysis.ResponseByClaim).map((r) => r.Result);
    const fakeCount = results.filter((r) => r === "Fake").length;
    const trueCount = results.filter((r) => r === "True").length;
    if (fakeCount > trueCount) return "Fake";
    if (trueCount > fakeCount) return "True";
    return "Misleading";
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
        {/* Header com Busca e Exportar */}
        <div className="mb-8 space-y-4">
          <h1 className="text-4xl font-bold">Analytics Dashboard</h1>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por texto, tópico ou ID..."
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Dados
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <AnalysisSidebar />
          </aside>

          {/* Conteúdo Principal */}
          <main className="lg:col-span-3">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="messages">Mensagens</TabsTrigger>
                <TabsTrigger value="claims">Claims</TabsTrigger>
                <TabsTrigger value="sources">Fontes</TabsTrigger>
              </TabsList>

              {/* Aba Overview */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  <MetricsCard
                    title="Fontes Únicas"
                    value="12"
                    icon={BarChart3}
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
                    {analyses.map((analysis) => (
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

              {/* Aba Claims */}
              <TabsContent value="claims" className="space-y-6">
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Visualização de claims em desenvolvimento</p>
                </div>
              </TabsContent>

              {/* Aba Fontes */}
              <TabsContent value="sources" className="space-y-6">
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Análise de fontes em desenvolvimento</p>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <MessageDetailDialog
        analysis={selectedAnalysis}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default Analytics;
