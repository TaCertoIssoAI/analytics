import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Calendar, Tag, Share2, Download, Mic, Camera, Image as ImageIcon, FileText, Link as LinkIcon, Eye, ExternalLink } from "lucide-react";
import { Analysis, ScrapedLink } from "@/types/analysis";
import { ClaimCard } from "@/components/analytics/ClaimCard";
import { ScrapedLinkModal } from "@/components/analytics/ScrapedLinkModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/auth/useAuth";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown } from "lucide-react";

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
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  "CHECK": {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  "UNVERIFIED": {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  "FONTES INSUFICIENTES PARA VERIFICAR": {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
};

const Verification = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<ScrapedLink | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Like/Dislike state
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [userDisliked, setUserDisliked] = useState(false);
  const [likedBy, setLikedBy] = useState<string[]>([]);
  const [dislikedBy, setDislikedBy] = useState<string[]>([]);
  
  interface InteractionUser {
    uid: string;
    displayName: string;
    action: 'like' | 'dislike';
  }
  const [reviewers, setReviewers] = useState<InteractionUser[]>([]);

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
          // Initialize like/dislike state
          const likedByList = result.data.liked_by || [];
          const dislikedByList = result.data.disliked_by || [];
          setLikedBy(likedByList);
          setDislikedBy(dislikedByList);
          setLikes(likedByList.length);
          setDislikes(dislikedByList.length);
          
          if (currentUser) {
            setUserLiked(likedByList.includes(currentUser.uid));
            setUserDisliked(dislikedByList.includes(currentUser.uid));
          }
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
    
    const loadInteractions = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        console.log("Fetching interactions for:", id);
        const response = await fetch(`${apiUrl}/analises/${id}/interactions`);
        if (response.ok) {
          const data = await response.json();
          console.log("Interactions data:", data);
          setReviewers(data.interactions || []);
        }
      } catch (error) {
        console.error("Erro ao carregar interações:", error);
      }
    };

    loadAnalysis();
    loadInteractions();
  }, [id, navigate, currentUser]);

  const handleLike = async () => {
    if (!currentUser) {
      toast.error("Você precisa estar logado para avaliar.");
      navigate("/login");
      return;
    }
    if (!analysis) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const uid = currentUser.uid;
    const action = userLiked ? 'remove_like' : 'like';

    try {
      // Optimistic update
      if (userLiked) {
        setLikes(prev => prev - 1);
        setUserLiked(false);
        setLikedBy(prev => prev.filter(id => id !== uid));
      } else {
        setLikes(prev => prev + 1);
        setUserLiked(true);
        setLikedBy(prev => [...prev, uid]);
        
        if (userDisliked) {
          setDislikes(prev => prev - 1);
          setUserDisliked(false);
          setDislikedBy(prev => prev.filter(id => id !== uid));
        }
      }

      const response = await fetch(`${apiUrl}/analises/${analysis.document_id}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, action })
      });

      if (!response.ok) {
        throw new Error("Failed to update interaction");
      }

    } catch (error) {
      console.error("Error updating like:", error);
      toast.error("Erro ao atualizar avaliação.");
      // TODO: Revert optimistic update on error
    }
  };

  const handleDislike = async () => {
    if (!currentUser) {
      toast.error("Você precisa estar logado para avaliar.");
      navigate("/login");
      return;
    }
    if (!analysis) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const uid = currentUser.uid;
    const action = userDisliked ? 'remove_dislike' : 'dislike';

    try {
      // Optimistic update
      if (userDisliked) {
        setDislikes(prev => prev - 1);
        setUserDisliked(false);
        setDislikedBy(prev => prev.filter(id => id !== uid));
      } else {
        setDislikes(prev => prev + 1);
        setUserDisliked(true);
        setDislikedBy(prev => [...prev, uid]);

        if (userLiked) {
          setLikes(prev => prev - 1);
          setUserLiked(false);
          setLikedBy(prev => prev.filter(id => id !== uid));
        }
      }

      const response = await fetch(`${apiUrl}/analises/${analysis.document_id}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, action })
      });

      if (!response.ok) {
        throw new Error("Failed to update interaction");
      }

    } catch (error) {
      console.error("Error updating dislike:", error);
      toast.error("Erro ao atualizar avaliação.");
      // TODO: Revert optimistic update on error
    }
  };

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

            <div className="flex gap-3 pt-4 items-center">
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
              
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex flex-col items-center">
                  <Button 
                    variant={userLiked ? "default" : "outline"} 
                    size="sm" 
                    className="gap-2"
                    onClick={handleLike}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {likes}
                  </Button>
                </div>

                <div className="flex flex-col items-center">
                  <Button 
                    variant={userDisliked ? "destructive" : "outline"} 
                    size="sm" 
                    className="gap-2"
                    onClick={handleDislike}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    {dislikes}
                  </Button>
                </div>
              </div>
              
              
              {/* Reviewers Modal */}
              {reviewers.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="link" className="p-0 h-auto font-semibold text-primary hover:underline">
                      Ver revisores que avaliaram
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Revisores que avaliaram</DialogTitle>
                      <DialogDescription>
                        Estas são as avaliações da análise feita pela AI, realizada pelos revisores certificados do TaCertoIsso AI.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                      {reviewers.map((reviewer) => (
                        <Link 
                          key={reviewer.uid} 
                          to={`/profile/${reviewer.uid}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                              {reviewer.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium group-hover:text-primary transition-colors">
                              {reviewer.displayName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            {reviewer.action === 'like' ? (
                              <div className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                <ThumbsUp className="h-3 w-3" />
                                <span>Aprovou</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                                <ThumbsDown className="h-3 w-3" />
                                <span>Reprovou</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
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
                          title={`Fontes insuficientes para verificar: ${analysis.analysis_metrics.unverified_score}%`}
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
