import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, ExternalLink } from "lucide-react";
import { Claim } from "@/types/analysis";
import iptcMapping from "@/data/iptcMapping.json";

interface ClaimCardProps {
  claim: Claim;
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

export const ClaimCard = ({ claim }: ClaimCardProps) => {
  const config = resultConfig[claim.verdict.toUpperCase()] || resultConfig["CHECK"];
  const Icon = config.icon;

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


              <div className="flex flex-wrap gap-2">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
