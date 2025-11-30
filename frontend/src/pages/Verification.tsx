import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Calendar, Tag, Share2, Download, Mic, Camera, Image as ImageIcon, FileText, Link as LinkIcon, Eye } from "lucide-react";
import { Analysis, ScrapedLink } from "@/types/analysis";
import { ClaimCard } from "@/components/analytics/ClaimCard";
import { ScrapedLinkModal } from "@/components/analytics/ScrapedLinkModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  "VERDADEIRO": {
    label: "Verdadeiro",
    icon: CheckCircle2,
    className: "bg-status-true/10 text-status-true border-status-true/20",
  },
  "FALSO": {
    label: "Falso",
    icon: XCircle,
    className: "bg-status-false/10 text-status-false border-status-false/20",
  },
  "DESCONHECIDO": {
    label: "Desconhecido",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  "CHECK": {
    label: "Não Verificável",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  "UNVERIFIED": {
    label: "Não Verificável",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
};

const Verification = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<ScrapedLink | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        // Usa a API do backend ao invés de JSONs estáticos
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/analises/${id}`);

        if (!response.ok) {
          navigate("/verificacao-nao-encontrada");
          return;
        }

        const result = await response.json();

        // A API retorna { success: true, data: {...}, message: "..." }
        if (result.success && result.data) {
          setAnalysis(result.data);
        } else {
          navigate("/verificacao-nao-encontrada");
        }
      } catch (error) {
        console.error("Erro ao carregar análise:", error);
        navigate("/verificacao-nao-encontrada");
      } finally {
        setLoading(false);
      }
    };
    loadAnalysis();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Carregando análise...</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const statusKey = analysis.overall_verdict.toUpperCase() as keyof typeof statusConfig;
  const config = statusConfig[statusKey] || statusConfig["DESCONHECIDO"];
  const StatusIcon = config.icon;

  const modalityIcons = [];
  if (analysis.media_info.has_audio) modalityIcons.push({ icon: Mic, label: "Áudio" });
  if (analysis.media_info.has_image) modalityIcons.push({ icon: ImageIcon, label: "Imagem" });
  if (analysis.media_info.has_video) modalityIcons.push({ icon: Camera, label: "Vídeo" });
  if (analysis.user_message_text) modalityIcons.push({ icon: FileText, label: "Texto" });

  // Coletar todos os tópicos únicos das claims
  const allTopics = Array.from(
    new Set(analysis.claims.flatMap(claim => claim.topics))
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <article className="container py-12 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {analysis.analysis_metrics ? (
                <>
                  {analysis.analysis_metrics.true_count > 0 && (
                    <div className="h-4 w-4 rounded-full bg-status-true" title="Contém informações verdadeiras" />
                  )}
                  {analysis.analysis_metrics.fake_count > 0 && (
                    <div className="h-4 w-4 rounded-full bg-status-false" title="Contém informações falsas" />
                  )}
                  {analysis.analysis_metrics.unverified_count > 0 && (
                    <div className="h-4 w-4 rounded-full bg-status-unverifiable" title="Contém informações não verificáveis" />
                  )}
                </>
              ) : (
                <Badge variant="outline" className={`${config.className} text-base py-1.5 px-4`}>
                  <StatusIcon className="h-4 w-4 mr-2" />
                  {config.label}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {analysis.analysis_title || analysis.full_combined_text}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(analysis.processed_at), "PPP 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                ID: {analysis.document_id.slice(0, 8)}
              </div>
            </div>

            {/* Modalidades */}
            <div className="flex items-center gap-2 flex-wrap">
              {modalityIcons.map(({ icon: Icon, label }) => (
                <Badge key={label} variant="secondary">
                  <Icon className="h-3 w-3 mr-1" />
                  {label}
                </Badge>
              ))}
            </div>

            {/* Tópicos */}
            {allTopics.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {allTopics.map((topic) => (
                  <Badge key={topic} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
            </div>
          </div>

            {/* Métricas de Veracidade */}
            {analysis.analysis_metrics && (
              <Card className="border-none shadow-sm bg-muted/30">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm font-medium mb-2">
                      <span>Nível de Veracidade</span>
                      <span className="text-muted-foreground">{analysis.analysis_metrics.total_claims} afirmações analisadas</span>
                    </div>
                    
                    {/* Barra de Progresso Segmentada */}
                    <div className="h-4 w-full flex rounded-full overflow-hidden bg-secondary">
                      {analysis.analysis_metrics.truth_score > 0 && (
                        <div 
                          style={{ width: `${analysis.analysis_metrics.truth_score}%` }} 
                          className="h-full bg-status-true"
                          title={`Verdadeiro: ${analysis.analysis_metrics.truth_score}%`}
                        />
                      )}
                      {analysis.analysis_metrics.fake_score > 0 && (
                        <div 
                          style={{ width: `${analysis.analysis_metrics.fake_score}%` }} 
                          className="h-full bg-status-false"
                          title={`Falso: ${analysis.analysis_metrics.fake_score}%`}
                        />
                      )}
                      {analysis.analysis_metrics.unverified_score > 0 && (
                        <div 
                          style={{ width: `${analysis.analysis_metrics.unverified_score}%` }} 
                          className="h-full bg-status-unverifiable"
                          title={`Não Verificável: ${analysis.analysis_metrics.unverified_score}%`}
                        />
                      )}
                    </div>

                    {/* Legenda e Contadores */}
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                        <span className="text-2xl font-bold text-status-true">{analysis.analysis_metrics.true_count}</span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verdadeiras</span>
                        <span className="text-xs text-muted-foreground mt-1">{analysis.analysis_metrics.truth_score}%</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                        <span className="text-2xl font-bold text-status-false">{analysis.analysis_metrics.fake_count}</span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Falsas</span>
                        <span className="text-xs text-muted-foreground mt-1">{analysis.analysis_metrics.fake_score}%</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                        <span className="text-2xl font-bold text-status-unverifiable">{analysis.analysis_metrics.unverified_count}</span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outros</span>
                        <span className="text-xs text-muted-foreground mt-1">{analysis.analysis_metrics.unverified_score}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Conteúdo Original */}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold">Conteúdo Verificado</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Mensagem Original</h4>
                <p className="text-foreground">{analysis.user_message_text}</p>
              </div>

              {analysis.media_info.has_audio && analysis.media_info.audio_text && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Transcrição do Áudio</h4>
                  <p className="text-sm text-muted-foreground">{analysis.media_info.audio_text}</p>
                </div>
              )}

              {analysis.media_info.has_image && analysis.media_info.image_text && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Texto da Imagem</h4>
                  <p className="text-sm text-muted-foreground">{analysis.media_info.image_text}</p>
                </div>
              )}

              {analysis.media_info.has_video && analysis.media_info.video_text && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Texto do Vídeo</h4>
                  <p className="text-sm text-muted-foreground">{analysis.media_info.video_text}</p>
                </div>
              )}

              {analysis.scraped_links.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Links Encontrados</h4>
                  <div className="space-y-2">
                    {analysis.scraped_links.map((link, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between gap-3">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium hover:underline text-primary flex-1 min-w-0"
                          >
                            <LinkIcon className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{link.title}</span>
                          </a>
                          {link.scraped_text && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLink(link);
                                setLinkModalOpen(true);
                              }}
                              className="gap-2 flex-shrink-0"
                            >
                              <Eye className="h-3 w-3" />
                              Ver Scraped Text
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Afirmações Verificadas */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Afirmações Verificadas</h2>
            <div className="space-y-4">
              {analysis.claims.map((claim) => (
                <ClaimCard
                  key={claim.claim_id}
                  claim={claim}
                />
              ))}
            </div>
          </div>

          {/* Resposta Final */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <h2 className="text-2xl font-semibold">Conclusão</h2>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium text-foreground">{analysis.final_comment}</p>
            </CardContent>
          </Card>
        </div>
      </article>

      <ScrapedLinkModal
        link={selectedLink}
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
      />
    </div>
  );
};

export default Verification;
