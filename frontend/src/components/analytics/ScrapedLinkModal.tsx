import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ScrapedLink } from "@/types/analysis";

interface ScrapedLinkModalProps {
  link: ScrapedLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScrapedLinkModal = ({ link, open, onOpenChange }: ScrapedLinkModalProps) => {
  const [copied, setCopied] = useState(false);

  if (!link) return null;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(link.scraped_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar texto:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Conteúdo Extraído do Site</DialogTitle>
          <DialogDescription className="sr-only">
            Visualização do texto extraído do link selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Link Info */}
          <div className="flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                Link Original
              </Badge>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate flex-1"
              >
                {link.url}
              </a>
            </div>

            {link.title && (
              <div>
                <h3 className="font-semibold text-sm mb-1">Título</h3>
                <p className="text-sm text-foreground">{link.title}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar Texto
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Site
                </a>
              </Button>
            </div>
          </div>

          {/* Scraped Text */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="font-semibold text-sm mb-2 flex-shrink-0">Texto Extraído</h3>
            <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {link.scraped_text}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
