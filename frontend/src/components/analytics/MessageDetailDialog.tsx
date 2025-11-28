import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Camera, Image as ImageIcon, FileText, Users, User, ExternalLink } from "lucide-react";
import { Analysis } from "@/types/analysis";
import { ClaimCard } from "./ClaimCard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface MessageDetailDialogProps {
  analysis: Analysis | null;
  fileId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MessageDetailDialog = ({ analysis, fileId, open, onOpenChange }: MessageDetailDialogProps) => {
  const navigate = useNavigate();

  if (!analysis) return null;

  const modalityIcons = [];
  if (analysis.HadAudio) modalityIcons.push({ icon: Mic, label: "Áudio" });
  if (analysis.HadImage) modalityIcons.push({ icon: ImageIcon, label: "Imagem" });
  if (analysis.HadVideo) modalityIcons.push({ icon: Camera, label: "Vídeo" });
  if (analysis.PureText) modalityIcons.push({ icon: FileText, label: "Texto" });

  const handleExpandClick = () => {
    if (fileId) {
      navigate(`/verificacao/${fileId}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes da Análise</DialogTitle>
            {fileId && (
              <Button onClick={handleExpandClick} variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Expandir
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header da Mensagem */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">
                  {analysis.MessageType === "FromWhatsappGroup" ? (
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
                  {format(new Date(analysis.Date), "PPP 'às' HH:mm", { locale: ptBR })}
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
                <h4 className="font-semibold text-sm mb-1">Texto</h4>
                <p className="text-sm text-muted-foreground">{analysis.FinalTranscribedText}</p>
              </div>
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

          {/* Tópicos */}
          {analysis.Topics.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Tópicos</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.Topics.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Claims */}
          <div>
            <h3 className="font-semibold mb-3">Afirmações Verificadas</h3>
            <div className="space-y-3">
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

          {/* Contexto Completo */}
          {analysis.CommentAboutCompleteContext && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contexto Completo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {analysis.CommentAboutCompleteContext}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Resposta Final */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg">Resposta Final</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{analysis.FinalResponseText}</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
