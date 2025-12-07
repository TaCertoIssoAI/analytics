import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExternalLink, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { AnalysisWithFileId } from "@/lib/loadAnalyses";

interface SourceCitation {
  analysis: AnalysisWithFileId;
  claimId: string;
  claimText: string;
  result: string;
}

interface SourceDetailDialogProps {
  source: string | null;
  citations: SourceCitation[];
  totalCitations: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SourceDetailDialog = ({ source, citations, totalCitations, open, onOpenChange }: SourceDetailDialogProps) => {
  const navigate = useNavigate();

  if (!source) return null;

  // Agrupar por análise única
  const uniqueAnalyses = citations.reduce((acc, citation) => {
    const existing = acc.find(item => item.analysis.document_id === citation.analysis.document_id);
    if (!existing) {
      acc.push({
        analysis: citation.analysis,
        claims: [{ claimId: citation.claimId, claimText: citation.claimText, result: citation.result }]
      });
    } else {
      existing.claims.push({ claimId: citation.claimId, claimText: citation.claimText, result: citation.result });
    }
    return acc;
  }, [] as Array<{
    analysis: AnalysisWithFileId;
    claims: Array<{ claimId: string; claimText: string; result: string }>;
  }>);

  const handleAnalysisClick = (fileId: string) => {
    navigate(`/verificacao/${fileId}`);
    onOpenChange(false);
  };

  const resultColors: Record<string, string> = {
    VERDADEIRO: "bg-status-true/10 text-status-true border-status-true/20",
    FALSO: "bg-status-false/10 text-status-false border-status-false/20",
    ENGANOSO: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
    CHECK: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
    UNVERIFIED: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Detalhes da Fonte
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes da fonte citada, estatísticas e análises relacionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL da Fonte */}
          <Card>
            <CardHeader>
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {source}
              </a>
            </CardHeader>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{totalCitations}</div>
                  <div className="text-sm text-muted-foreground">Total de Citações</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{uniqueAnalyses.length}</div>
                  <div className="text-sm text-muted-foreground">Análises Únicas</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Análises */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Análises que Usaram esta Fonte</h3>
            <div className="space-y-4">
              {uniqueAnalyses.map(({ analysis, claims }) => (
                <Card
                  key={analysis.document_id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => handleAnalysisClick(analysis.fileId)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">
                            {analysis.analysis_title || "Sem título"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {analysis.user_message_text}
                          </p>
                          <div className="space-y-2">
                            {claims.map((claim, idx) => (
                              <div key={`${claim.claimId}-${idx}`} className="flex items-start gap-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    resultColors[claim.result.toUpperCase()] ||
                                    resultColors.CHECK
                                  }
                                >
                                  {claim.result === "FALSO"
                                    ? "Falso"
                                    : claim.result === "VERDADEIRO"
                                    ? "Verdadeiro"
                                    : "Fontes insuficientes para verificar"}
                                </Badge>
                                <p className="text-xs text-muted-foreground flex-1">
                                  {claim.claimText}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(analysis.processed_at), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </div>
                        <div>ID: {analysis.fileId}</div>
                        <div className="ml-auto">
                          {claims.length} {claims.length === 1 ? "citação" : "citações"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
