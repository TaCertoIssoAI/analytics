import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Camera, Image as ImageIcon, FileText, Users, User, ExternalLink, Link as LinkIcon, Eye } from "lucide-react";
import { Analysis, ScrapedLink } from "@/types/analysis";
import { ClaimCard } from "./ClaimCard";
import { ScrapedLinkModal } from "./ScrapedLinkModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface MessageDetailDialogProps {
  analysis: Analysis | null;
  fileId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MessageDetailDialog = ({ analysis, fileId, open, onOpenChange }: MessageDetailDialogProps) => {
  const navigate = useNavigate();
  const [selectedLink, setSelectedLink] = useState<ScrapedLink | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  if (!analysis) return null;

  const modalityIcons = [];
  if (analysis.media_info.has_audio) modalityIcons.push({ icon: Mic, label: "Áudio" });
  if (analysis.media_info.has_image) modalityIcons.push({ icon: ImageIcon, label: "Imagem" });
  if (analysis.media_info.has_video) modalityIcons.push({ icon: Camera, label: "Vídeo" });
  if (analysis.user_message_text) modalityIcons.push({ icon: FileText, label: "Texto" });

  const handleExpandClick = () => {
    if (fileId) {
      navigate(`/verificacao/${fileId}`);
      onOpenChange(false);
    }
  };

  // Coletar todos os tópicos únicos das claims
  const allTopics = Array.from(
    new Set(analysis.claims.flatMap(claim => claim.topics))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{analysis.analysis_title || "Detalhes da Análise"}</DialogTitle>
            {fileId && (
              <Button onClick={handleExpandClick} variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Expandir
              </Button>
            )}
          </div>
          <DialogDescription className="sr-only">
            Detalhes completos da análise, incluindo conteúdo original, transcrições e verificações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header da Mensagem */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">
                  {analysis.source_type === "FromWhatsappGroup" ? (
                    <>
                      <Users className="h-3 w-3 mr-1" />
                      Grupo do WhatsApp
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3 mr-1" />
                      Mensagem Direta
                    </>
                  )}
                </Badge>
                {modalityIcons.map(({ icon: Icon, label }) => (
                  <Badge key={label} variant="secondary">
                    <Icon className="h-3 w-3 mr-1" />
                    {label}
                  </Badge>
                ))}
                <span className="text-sm text-muted-foreground ml-auto">
                  {format(new Date(analysis.processed_at), "PPP 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </CardHeader>
          </Card>

          {/* Conteúdo Original */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conteúdo Original</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">Mensagem Original</h4>
                <p className="text-sm text-muted-foreground">{analysis.user_message_text}</p>
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
                      <div key={index} className="border rounded-lg p-2 bg-muted/30">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs font-medium hover:underline text-primary flex-1 min-w-0"
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
                              className="gap-1 flex-shrink-0 text-xs h-7"
                            >
                              <Eye className="h-3 w-3" />
                              Ver Texto
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

          {/* Tópicos */}
          {allTopics.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Tópicos</h3>
              <div className="flex flex-wrap gap-2">
                {allTopics.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {topic.split('|')[0]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Claims */}
          <div>
            <h3 className="font-semibold mb-3">Afirmações Verificadas</h3>
            <div className="space-y-3">
              {analysis.claims.map((claim) => (
                <ClaimCard
                  key={claim.claim_id}
                  claim={claim}
                />
              ))}
            </div>
          </div>

          {/* Resposta Final */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg">Conclusão</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{analysis.final_comment}</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>

      <ScrapedLinkModal
        link={selectedLink}
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
      />
    </Dialog>
  );
};
