import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Calendar, Tag, Share2, Download, Mic, Camera, Image as ImageIcon, FileText } from "lucide-react";
import { Analysis } from "@/types/analysis";
import { ClaimCard } from "@/components/analytics/ClaimCard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  true: {
    label: "Verdadeiro",
    icon: CheckCircle2,
    className: "bg-status-true/10 text-status-true border-status-true/20",
  },
  false: {
    label: "Falso",
    icon: XCircle,
    className: "bg-status-false/10 text-status-false border-status-false/20",
  },
  misleading: {
    label: "Enganoso",
    icon: AlertTriangle,
    className: "bg-status-misleading/10 text-status-misleading border-status-misleading/20",
  },
  unverifiable: {
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

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const response = await fetch(`/analises/${id}.json`);
        if (!response.ok) {
          navigate("/verificacao-nao-encontrada");
          return;
        }
        const data = await response.json();
        setAnalysis(data);
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

  // Determinar resultado principal
  const results = Object.values(analysis.ResponseByClaim).map((r) => r.Result);
  const fakeCount = results.filter((r) => r === "Fake").length;
  const trueCount = results.filter((r) => r === "True").length;
  let mainStatus: "true" | "false" | "misleading" | "unverifiable" = "unverifiable";
  
  if (fakeCount > trueCount) mainStatus = "false";
  else if (trueCount > fakeCount) mainStatus = "true";
  else if (results.some(r => r === "Misleading")) mainStatus = "misleading";

  const config = statusConfig[mainStatus];
  const StatusIcon = config.icon;

  const modalityIcons = [];
  if (analysis.HadAudio) modalityIcons.push({ icon: Mic, label: "Áudio" });
  if (analysis.HadImage) modalityIcons.push({ icon: ImageIcon, label: "Imagem" });
  if (analysis.HadVideo) modalityIcons.push({ icon: Camera, label: "Vídeo" });
  if (analysis.PureText) modalityIcons.push({ icon: FileText, label: "Texto" });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <article className="container py-12 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <Badge variant="outline" className={`${config.className} text-base py-1.5 px-4`}>
              <StatusIcon className="h-4 w-4 mr-2" />
              {config.label}
            </Badge>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {analysis.FinalTranscribedText}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(analysis.Date), "PPP 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                ID: {analysis.DocumentId.slice(0, 8)}
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
            {analysis.Topics.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {analysis.Topics.map((topic) => (
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
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Baixar JSON
              </Button>
            </div>
          </div>

          {/* Conteúdo Original */}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold">Conteúdo Verificado</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground">{analysis.FinalTranscribedText}</p>
              
              {analysis.HadAudio && analysis.AudioText && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Transcrição do Áudio</h4>
                  <p className="text-sm text-muted-foreground">{analysis.AudioText}</p>
                </div>
              )}
              
              {analysis.HadImage && analysis.ImageText && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Texto da Imagem</h4>
                  <p className="text-sm text-muted-foreground">{analysis.ImageText}</p>
                </div>
              )}
              
              {analysis.HadVideo && analysis.VideoText && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Texto do Vídeo</h4>
                  <p className="text-sm text-muted-foreground">{analysis.VideoText}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Afirmações Verificadas */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Afirmações Verificadas</h2>
            <div className="space-y-4">
              {Object.entries(analysis.Claims).map(([id, claim]) => (
                <ClaimCard
                  key={id}
                  claimId={id}
                  claim={claim}
                  response={analysis.ResponseByClaim[id]}
                />
              ))}
            </div>
          </div>

          {/* Contexto e Resposta Final */}
          {analysis.CommentAboutCompleteContext && (
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold">Contexto Completo</h2>
              </CardHeader>
              <CardContent>
                <p className="text-foreground">{analysis.CommentAboutCompleteContext}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-2 border-primary/20">
            <CardHeader>
              <h2 className="text-2xl font-semibold">Resposta Final</h2>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium text-foreground">{analysis.FinalResponseText}</p>
            </CardContent>
          </Card>
        </div>
      </article>
    </div>
  );
};

export default Verification;
