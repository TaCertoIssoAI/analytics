import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Camera, Image as ImageIcon, FileText, Users, User, ExternalLink, Link as LinkIcon, Eye, X } from "lucide-react";
import { Analysis, ScrapedLink } from "@/types/analysis";
import { ClaimCard } from "./ClaimCard";
import { ScrapedLinkModal } from "./ScrapedLinkModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { translateContentTags } from "@/lib/translateContentTags";
import ReactMarkdown from "react-markdown";

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

  const normalizeMarkdown = (text: string) =>
    text
      // Alguns registros chegam com quebras "duplamente escapadas" ("\\n")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      // Normaliza diferentes "asteriscos" unicode para '*'
      .replace(/[＊∗✱✳✲✴]/g, "*")
      // Normaliza bullets comuns para '- '
      .replace(/^(\s*)[•·]\s+/gm, "$1- ")
      // Evita que listas virem bloco de código (CommonMark: >=4 espaços vira code block)
      .replace(/^\s{4,}([*-])\s+/gm, "  $1 ")
      .replace(/^\s{4,}(\d+\.)\s+/gm, "  $1 ")
      // Evita CRLF quebrando parsing
      .replace(/\r\n/g, "\n");

  const MarkdownText = ({ text }: { text: string }) => (
    <ReactMarkdown
      components={{
        h1: (props) => <h3 className="text-base font-semibold" {...props} />,
        h2: (props) => <h4 className="text-sm font-semibold" {...props} />,
        h3: (props) => <h5 className="text-sm font-semibold" {...props} />,
        p: (props) => <p className="text-sm leading-relaxed" {...props} />,
        ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
        ol: (props) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
        li: (props) => <li className="text-sm leading-relaxed" {...props} />,
        strong: (props) => <strong className="font-semibold" {...props} />,
        em: (props) => <em className="italic" {...props} />,
        code: (props) => <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props} />,
        pre: (props) => <pre className="overflow-x-auto rounded bg-muted p-3 text-xs" {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden">
        <DialogHeader className="text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle>{analysis.analysis_title || "Detalhes da Análise"}</DialogTitle>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              {fileId && (
                <Button onClick={handleExpandClick} variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Expandir
                </Button>
              )}
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-sm opacity-70 hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fechar</span>
                </Button>
              </DialogClose>
            </div>
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
                <div className="text-sm text-muted-foreground break-words">
                  <MarkdownText text={translateContentTags(normalizeMarkdown(analysis.user_message_text))} />
                </div>
              </div>
              {analysis.media_info.has_audio && analysis.media_info.audio_text && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Transcrição do Áudio</h4>
                  <div className="text-sm text-muted-foreground break-words">
                    <MarkdownText text={translateContentTags(normalizeMarkdown(analysis.media_info.audio_text))} />
                  </div>
                </div>
              )}
              {analysis.media_info.has_image && analysis.media_info.image_text && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Texto da Imagem</h4>
                  <div className="text-sm text-muted-foreground break-words">
                    <MarkdownText text={translateContentTags(normalizeMarkdown(analysis.media_info.image_text))} />
                  </div>
                </div>
              )}
              {analysis.media_info.has_video && analysis.media_info.video_text && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Texto do Vídeo</h4>
                  <div className="text-sm text-muted-foreground break-words">
                    <MarkdownText text={translateContentTags(normalizeMarkdown(analysis.media_info.video_text))} />
                  </div>
                </div>
              )}
              {analysis.scraped_links.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Links Encontrados</h4>
                  <div className="space-y-2">
                    {analysis.scraped_links.map((link, index) => (
                      <div key={index} className="border rounded-lg p-2 bg-muted/30">
                        <div className="flex flex-col gap-2">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs font-medium hover:underline text-primary break-all"
                          >
                            <LinkIcon className="h-3 w-3 flex-shrink-0" />
                            <span>{link.title || link.url}</span>
                          </a>
                          {link.scraped_text && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLink(link);
                                setLinkModalOpen(true);
                              }}
                              className="gap-1 w-full sm:w-auto text-xs h-7"
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
