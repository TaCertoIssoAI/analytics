import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Calendar, Tag } from "lucide-react";


import { AnalysisMetrics } from "@/types/analysis";

export interface Tag {
  name: string;
  id?: string;
}

interface VerificationCardProps {
  id: string;
  title: string;
  status: "true" | "false" | "unverifiable";
  date: string;
  tags: Tag[];
  excerpt: string;
  analysis_metrics?: AnalysisMetrics;
}

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
  unverifiable: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className: "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
};

import { Link } from "react-router-dom";

export const VerificationCard = ({ id, title, status, date, tags, excerpt, analysis_metrics }: VerificationCardProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const handleTagClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Link 
      to={`/verificacao/${id}`}
      className="block h-full no-underline"
    >
      <Card 
        className="h-full transition-all hover:shadow-md hover:border-primary/50"
      >
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-lg line-clamp-2 leading-tight">{title}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {analysis_metrics ? (
                <>
                  {analysis_metrics.true_count > 0 && (
                    <div className="h-3 w-3 rounded-full bg-status-true" title="Contém informações verdadeiras" />
                  )}
                  {analysis_metrics.fake_count > 0 && (
                    <div className="h-3 w-3 rounded-full bg-status-false" title="Contém informações falsas" />
                  )}
                  {(analysis_metrics.out_of_context_count || 0) > 0 && (
                    <div className="h-3 w-3 rounded-full bg-yellow-500" title="Contém informações fora de contexto" />
                  )}
                  {analysis_metrics.unverified_count > 0 && (
                    <div className="h-3 w-3 rounded-full bg-status-unverifiable" title="Contém informações não verificáveis" />
                  )}
                </>
              ) : (
                <Badge variant="outline" className={config.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{excerpt}</p>
        </CardContent>

        <CardFooter className="flex flex-col items-start gap-3 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {date}
          </div>
          
          {tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {tags.map((tag) => (
                tag.id ? (
                  <span 
                    key={tag.name} 
                    role="link"
                    tabIndex={0}
                    onClick={(e) => handleTagClick(e, `https://cv.iptc.org/newscodes/mediatopic/${tag.id}`)}
                    className="cursor-pointer"
                  >
                    <Badge variant="secondary" className="text-xs hover:bg-secondary/80 transition-colors">
                      {tag.name}
                    </Badge>
                  </span>
                ) : (
                  <Badge key={tag.name} variant="secondary" className="text-xs">
                    {tag.name}
                  </Badge>
                )
              ))}
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
};
