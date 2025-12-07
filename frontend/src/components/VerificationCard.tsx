import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Calendar, Tag } from "lucide-react";
import { Link } from "react-router-dom";

import { AnalysisMetrics } from "@/types/analysis";

interface VerificationCardProps {
  id: string;
  title: string;
  status: "true" | "false" | "unverifiable";
  date: string;
  tags: string[];
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

export const VerificationCard = ({ id, title, status, date, tags, excerpt, analysis_metrics }: VerificationCardProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Link to={`/verificacao/${id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
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
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
};
