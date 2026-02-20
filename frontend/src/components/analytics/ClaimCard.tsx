import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, ExternalLink, Network, Maximize2, Plus, Trash2, BookOpen, LinkIcon } from "lucide-react";
import { Claim, ClaimSuggestedSources, SuggestedSource } from "@/types/analysis";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import iptcMapping from "@/data/iptcMapping.json";
import { DecisionTreeAnimation } from "./DecisionTreeAnimation";
import { toast } from "sonner";
import { getValidPhotoUrl } from "@/lib/utils";

interface ClaimCardProps {
  claim: Claim;
  suggestedSources?: ClaimSuggestedSources[];
  canSuggestSources?: boolean;
  onSuggestSources?: (claimId: string, sources: SuggestedSource[], observation: string) => Promise<void>;
}

const resultConfig: Record<string, { label: string; icon: any; className: string }> = {
  VERDADEIRO: {
    label: "Verdadeiro",
    icon: CheckCircle2,
    className: "bg-status-true/10 text-status-true border-status-true/20",
  },
  FALSO: {
    label: "Falso",
    icon: XCircle,
    className: "bg-status-false/10 text-status-false border-status-false/20",
  },
  ENGANOSO: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  FORA_DE_CONTEXTO: {
    label: "Fora de Contexto",
    icon: AlertTriangle,
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  CHECK: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  UNVERIFIED: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
};

import iptcTreeData from "@/data/iptcTree.json";

// ...

// Type definition for the tree data (same as in DecisionTreeAnimation)
type TreeNode = {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
};

const iptcTree = iptcTreeData as Record<string, TreeNode>;

const getTopicDepth = (id: string): number => {
  let depth = 0;
  let current = iptcTree[id];
  while (current) {
    depth++;
    if (current.parent) {
      current = iptcTree[current.parent];
    } else {
      current = null; // @ts-ignore
    }
  }
  return depth;
};

export const ClaimCard = ({ claim, suggestedSources = [], canSuggestSources = false, onSuggestSources }: ClaimCardProps) => {
  const config = resultConfig[claim.verdict.toUpperCase()] || resultConfig["CHECK"];
  const Icon = config.icon;

  // Suggested sources modal state
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [newSources, setNewSources] = useState<SuggestedSource[]>([{ url: "", title: "" }]);
  const [sourceObservation, setSourceObservation] = useState("");
  const [submittingSources, setSubmittingSources] = useState(false);

  const handleAddSourceRow = () => {
    setNewSources(prev => [...prev, { url: "", title: "" }]);
  };

  const handleRemoveSourceRow = (index: number) => {
    setNewSources(prev => prev.filter((_, i) => i !== index));
  };

  const handleSourceChange = (index: number, field: "url" | "title", value: string) => {
    setNewSources(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleSubmitSources = async () => {
    const validSources = newSources.filter(s => s.url.trim());
    if (validSources.length === 0) {
      toast.error("Adicione pelo menos uma fonte com URL.");
      return;
    }
    if (!sourceObservation.trim()) {
      toast.error("A observação é obrigatória.");
      return;
    }
    
    // Auto-fill title from URL if empty
    const sourcesWithTitle = validSources.map(s => ({
      url: s.url.trim(),
      title: s.title.trim() || (() => { try { return new URL(s.url.trim()).hostname; } catch { return s.url.trim(); } })()
    }));

    setSubmittingSources(true);
    try {
      if (onSuggestSources) {
        await onSuggestSources(claim.claim_id, sourcesWithTitle, sourceObservation.trim());
      }
      setSuggestModalOpen(false);
      setNewSources([{ url: "", title: "" }]);
      setSourceObservation("");
    } catch {
      toast.error("Erro ao enviar fontes sugeridas.");
    } finally {
      setSubmittingSources(false);
    }
  };

  // Find the deepest topic to visualize
  let deepestTopicId: string | null = null;
  let maxDepth = -1;

  claim.topics.forEach(topicStr => {
    const parts = topicStr.split('|');
    let id = parts.length > 1 ? parts[1] : undefined;

    if (!id) {
      const lowerName = parts[0].toLowerCase();
      // @ts-ignore
      if (iptcMapping[lowerName]) {
         // @ts-ignore
        id = iptcMapping[lowerName];
      }
    }

    if (id && iptcTree[id]) {
      const depth = getTopicDepth(id);
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestTopicId = id;
      }
    }
  });

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={claim.claim_id} className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex flex-col items-start gap-2 text-left w-full">
            <Badge variant="outline" className={`${config.className} text-xs shrink-0`}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-sm font-medium">{claim.text}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Análise</h4>
            <p className="text-sm text-muted-foreground">{claim.reasoning}</p>
          </div>

          {claim.topics.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Tópicos</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {claim.topics.map((topicStr, index) => {
                  const parts = topicStr.split('|');
                  let name = parts[0];
                  let id = parts.length > 1 ? parts[1] : undefined;

                  if (!id) {
                    const lowerName = name.toLowerCase();
                    // @ts-ignore
                    if (iptcMapping[lowerName]) {
                       // @ts-ignore
                      id = iptcMapping[lowerName];
                    }
                  }

                  if (id) {
                    return (
                      <a 
                        key={index} 
                        href={`https://cv.iptc.org/newscodes/mediatopic/${id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="no-underline"
                      >
                        <Badge variant="secondary" className="text-xs hover:bg-secondary/80 transition-colors">
                          {name}
                        </Badge>
                      </a>
                    );
                  }
                  return (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {name}
                    </Badge>
                  );
                })}
              </div>

              {/* Inline Decision Tree Animation for the deepest topic */}
              {deepestTopicId && (
                <div className="border rounded-lg p-4 bg-card/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      Caminho de Classificação IPTC
                    </h4>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                          <Maximize2 className="h-3 w-3" />
                          Expandir
                        </button>
                      </DialogTrigger>
                      <DialogContent className="w-full h-full max-w-none m-0 rounded-none flex flex-col p-0 sm:max-w-none sm:h-full sm:m-0 sm:rounded-none">
                        <DialogHeader className="p-4 border-b shrink-0">
                          <DialogTitle className="flex items-center gap-2">
                            <Network className="h-5 w-5" />
                            Caminho de Classificação IPTC
                          </DialogTitle>
                          <DialogDescription className="sr-only">
                            Visualização detalhada e interativa do caminho de classificação da árvore de decisão.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-hidden bg-background">
                          <DecisionTreeAnimation targetId={deepestTopicId} forceFullView={true} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <DecisionTreeAnimation targetId={deepestTopicId} />
                </div>
              )}
            </div>
          )}

          {claim.sources.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Fontes Consultadas</h4>
              <div className="flex flex-wrap gap-2">
                {claim.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {source.publisher || new URL(source.url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Fontes Sugeridas por Revisores */}
          {suggestedSources.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Fontes Sugeridas por Revisores
              </h4>
              <div className="space-y-3">
                {suggestedSources.map((reviewer, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-6 w-6 border">
                        <AvatarImage src={getValidPhotoUrl(reviewer.photoURL)} alt={reviewer.displayName} />
                        <AvatarFallback className="text-xs">
                          {reviewer.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{reviewer.displayName}</span>
                    </div>
                    {reviewer.observation && (
                      <p className="text-xs text-muted-foreground mb-2 italic">"{reviewer.observation}"</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {reviewer.sources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded-md transition-colors"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {source.title || (() => { try { return new URL(source.url).hostname; } catch { return source.url; } })()}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão Sugerir Fontes */}
          {canSuggestSources && (
            <div>
              <Dialog open={suggestModalOpen} onOpenChange={(open) => {
                setSuggestModalOpen(open);
                if (!open) {
                  setNewSources([{ url: "", title: "" }]);
                  setSourceObservation("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-3 w-3" />
                    Sugerir Fontes
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Sugerir Fontes
                    </DialogTitle>
                    <DialogDescription>
                      Adicione pelo menos uma fonte e uma observação explicando a relevância. Outros revisores também poderão ver suas sugestões.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto p-1">
                    {newSources.map((source, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">URL *</Label>
                          <Input
                            placeholder="https://exemplo.com/artigo"
                            value={source.url}
                            onChange={(e) => handleSourceChange(index, "url", e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Título (opcional)</Label>
                          <Input
                            placeholder="Nome da fonte"
                            value={source.title}
                            onChange={(e) => handleSourceChange(index, "title", e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        {newSources.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 flex-shrink-0"
                            onClick={() => handleRemoveSourceRow(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleAddSourceRow}>
                      <Plus className="h-3 w-3" />
                      Adicionar outra fonte
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observação *</Label>
                    <Textarea
                      placeholder="Explique por que essas fontes são relevantes para esta afirmação..."
                      value={sourceObservation}
                      onChange={(e) => setSourceObservation(e.target.value.slice(0, 300))}
                      maxLength={300}
                      rows={3}
                      className="resize-none text-sm"
                    />
                    <p className="text-xs text-muted-foreground text-right">{sourceObservation.length}/300</p>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => { setSuggestModalOpen(false); setNewSources([{ url: "", title: "" }]); setSourceObservation(""); }}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSubmitSources}
                      disabled={submittingSources || !sourceObservation.trim() || !newSources.some(s => s.url.trim())}
                    >
                      {submittingSources ? "Enviando..." : "Enviar Sugestões"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
