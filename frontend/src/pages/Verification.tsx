import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Calendar,
  Tag,
  Share2,
  Download,
  Mic,
  Camera,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Eye,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Analysis, ScrapedLink, ClaimSuggestedSources, SuggestedSource } from "@/types/analysis";
import { ClaimCard } from "@/components/analytics/ClaimCard";
import { ScrapedLinkModal } from "@/components/analytics/ScrapedLinkModal";
import { RecommendationsSection } from "@/components/analytics/RecommendationsSection";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/auth/useAuth";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Linkedin, BadgeCheck, BookOpen, Lightbulb, Search, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import iptcMapping from "@/data/iptcMapping.json";
import { translateContentTags } from "@/lib/translateContentTags";
import { getValidPhotoUrl } from "@/lib/utils";
import { fetchWithAuth } from "@/auth/httpClient";

const statusConfig = {
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
  DESCONHECIDO: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className:
      "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  CHECK: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className:
      "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  UNVERIFIED: {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className:
      "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
  },
  "FONTES INSUFICIENTES PARA VERIFICAR": {
    label: "Fontes insuficientes para verificar",
    icon: HelpCircle,
    className:
      "bg-status-unverifiable/10 text-status-unverifiable border-status-unverifiable/20",
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
  const [scrapedTextsLoaded, setScrapedTextsLoaded] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>("");

  // Like/Dislike state
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [userDisliked, setUserDisliked] = useState(false);
  const [userNeutral, setUserNeutral] = useState(false);
  const [likedBy, setLikedBy] = useState<string[]>([]);
  const [dislikedBy, setDislikedBy] = useState<string[]>([]);

  interface InteractionUser {
    uid: string;
    displayName: string;
    photoURL?: string;
    occupation?: string;
    socials?: { linkedin?: string };
    action: "like" | "dislike" | "neutral";
    observation?: string;
    has_custom_observation?: boolean;
    suggested_sources?: Record<string, { items: { url: string; title?: string }[]; observation: string }>;
  }
  const [reviewers, setReviewers] = useState<InteractionUser[]>([]);

  // Observation modal state
  const [observationModalOpen, setObservationModalOpen] = useState(false);
  const [observationText, setObservationText] = useState("");
  const [pendingAction, setPendingAction] = useState<"like" | "dislike" | null>(
    null,
  );
  const [submittingObservation, setSubmittingObservation] = useState(false);
  // Modal for viewing a specific reviewer's observation
  const [viewingObservation, setViewingObservation] = useState<InteractionUser | null>(null);

  // Suggested sources state: { claim_id: ClaimSuggestedSources[] }
  const [suggestedSourcesByClaim, setSuggestedSourcesByClaim] = useState<Record<string, ClaimSuggestedSources[]>>({});

  // Info modal for suggesting sources when all claims are unverified
  const [suggestSourcesInfoOpen, setSuggestSourcesInfoOpen] = useState(false);

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
        p: (props) => <p className="leading-relaxed" {...props} />,
        ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
        ol: (props) => (
          <ol className="list-decimal pl-5 space-y-1" {...props} />
        ),
        li: (props) => <li className="leading-relaxed" {...props} />,
        strong: (props) => <strong className="font-semibold" {...props} />,
        em: (props) => <em className="italic" {...props} />,
        code: (props) => (
          <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props} />
        ),
        pre: (props) => (
          <pre
            className="overflow-x-auto rounded bg-muted p-3 text-xs"
            {...props}
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        // Usa a API do backend ao invés de JSONs estáticos
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/analises/${id}`);

        if (!response.ok) {
          navigate(`/verificacao-nao-encontrada/${id}`);
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
            const neutralByList = result.data.neutral_by || [];
            setUserNeutral(neutralByList.includes(currentUser.uid));
          }
        } else {
          navigate(`/verificacao-nao-encontrada/${id}`);
        }
      } catch (error) {
        console.error("Erro ao carregar análise:", error);
        navigate(`/verificacao-nao-encontrada/${id}`);
      } finally {
        setLoading(false);
      }
    };

    const loadInteractions = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/analises/${id}/interactions`);
        if (response.ok) {
          const data = await response.json();
          setReviewers(data.interactions || []);
        }
      } catch (error) {
        console.error("Erro ao carregar interações:", error);
      }
    };

    const loadSuggestedSources = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/analises/${id}/suggested-sources`);
        if (response.ok) {
          const data = await response.json();
          setSuggestedSourcesByClaim(data.suggested_sources || {});
        }
      } catch (error) {
        console.error("Erro ao carregar fontes sugeridas:", error);
      }
    };

    loadAnalysis();
    loadInteractions();
    loadSuggestedSources();
  }, [id, navigate, currentUser]);

  const handleSuggestSources = async (claimId: string, sources: SuggestedSource[], observation: string) => {
    if (!currentUser || !analysis) return;

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const response = await fetchWithAuth(
      `${apiUrl}/analises/${analysis.document_id}/suggested-sources`,
      {
        method: "POST",
        body: JSON.stringify({
          claim_id: claimId,
          sources,
          observation: observation || "",
        }),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Erro ao enviar fontes sugeridas");
    }

    // Backend auto-adds user to neutral_by on first source submission
    setUserNeutral(true);
    toast.success("Fontes sugeridas enviadas com sucesso!");

    // Reload suggested sources
    try {
      const reloadResponse = await fetch(`${apiUrl}/analises/${analysis.document_id}/suggested-sources`);
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        setSuggestedSourcesByClaim(data.suggested_sources || {});
      }
    } catch {
      // Silently fail reload
    }
  };

  const handleDeleteSuggestedSources = async (claimId: string, uid: string) => {
    if (!currentUser || !analysis) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const response = await fetchWithAuth(
      `${apiUrl}/analises/${analysis.document_id}/suggested-sources?claim_id=${encodeURIComponent(claimId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Erro ao remover fontes sugeridas");
    }
    toast.success("Fontes sugeridas removidas.");
    // Reload suggested sources
    try {
      const reloadResponse = await fetch(`${apiUrl}/analises/${analysis.document_id}/suggested-sources`);
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        setSuggestedSourcesByClaim(data.suggested_sources || {});
      }
    } catch {
      // Silently fail reload
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      toast.error("Você precisa estar logado para avaliar.");
      navigate("/entrar");
      return;
    }
    if (!analysis) return;

    // If already liked, remove like directly (no modal)
    if (userLiked) {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const uid = currentUser.uid;
      try {
        setLikes((prev) => prev - 1);
        setUserLiked(false);
        setLikedBy((prev) => prev.filter((id) => id !== uid));
        const response = await fetchWithAuth(
          `${apiUrl}/analises/${analysis.document_id}/interaction`,
          {
            method: "POST",
            body: JSON.stringify({ action: "remove_like" }),
          },
        );
        if (!response.ok) throw new Error("Failed to update interaction");
      } catch (error) {
        console.error("Error updating like:", error);
        toast.error("Erro ao atualizar avaliação.");
      }
      return;
    }

    // Open observation modal for new like
    setPendingAction("like");
    setObservationText("");
    setObservationModalOpen(true);
  };

  const handleDislike = async () => {
    if (!currentUser) {
      toast.error("Você precisa estar logado para avaliar.");
      navigate("/entrar");
      return;
    }
    if (!analysis) return;

    // If already disliked, remove dislike directly (no modal)
    if (userDisliked) {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const uid = currentUser.uid;
      try {
        setDislikes((prev) => prev - 1);
        setUserDisliked(false);
        setDislikedBy((prev) => prev.filter((id) => id !== uid));
        const response = await fetchWithAuth(
          `${apiUrl}/analises/${analysis.document_id}/interaction`,
          {
            method: "POST",
            body: JSON.stringify({ action: "remove_dislike" }),
          },
        );
        if (!response.ok) throw new Error("Failed to update interaction");
      } catch (error) {
        console.error("Error updating dislike:", error);
        toast.error("Erro ao atualizar avaliação.");
      }
      return;
    }

    // Open observation modal for new dislike
    setPendingAction("dislike");
    setObservationText("");
    setObservationModalOpen(true);
  };

  const handleSubmitObservation = async () => {
    if (!currentUser || !analysis || !pendingAction) return;

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const uid = currentUser.uid;
    const action = pendingAction;
    const observation = observationText.trim() || null; // Backend trata vazio como "Sem observações"

    setSubmittingObservation(true);
    try {
      // Optimistic update
      if (action === "like") {
        setLikes((prev) => prev + 1);
        setUserLiked(true);
        setLikedBy((prev) => [...prev, uid]);
        if (userDisliked) {
          setDislikes((prev) => prev - 1);
          setUserDisliked(false);
          setDislikedBy((prev) => prev.filter((id) => id !== uid));
        }
      } else {
        setDislikes((prev) => prev + 1);
        setUserDisliked(true);
        setDislikedBy((prev) => [...prev, uid]);
        if (userLiked) {
          setLikes((prev) => prev - 1);
          setUserLiked(false);
          setLikedBy((prev) => prev.filter((id) => id !== uid));
        }
      }

      const response = await fetchWithAuth(
        `${apiUrl}/analises/${analysis.document_id}/interaction`,
        {
          method: "POST",
          body: JSON.stringify({ action, observation }),
        },
      );

      if (!response.ok) throw new Error("Failed to update interaction");

      setObservationModalOpen(false);
      setPendingAction(null);
      setObservationText("");
    } catch (error) {
      console.error("Error submitting observation:", error);
      toast.error("Erro ao atualizar avaliação.");
    } finally {
      setSubmittingObservation(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: analysis?.analysis_title || "Análise de Verificação",
          text: "Confira esta análise de verificação no Tá Certo Isso AI!",
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copiado para a área de transferência!");
      } catch (error) {
        toast.error("Erro ao copiar link.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <article className="container py-12 max-w-7xl">
          <div className="space-y-8">
            {/* Header skeleton */}
            <div className="space-y-4">
              {/* Status dots */}
              <div className="flex items-center gap-2 mb-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-4 w-4 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
              {/* Title */}
              <div className="space-y-2">
                <div className="h-10 w-3/4 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "100ms" }} />
                <div className="h-10 w-1/2 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "200ms" }} />
              </div>
              {/* Date and ID */}
              <div className="flex flex-wrap gap-4">
                <div className="h-4 w-48 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "300ms" }} />
                <div className="h-4 w-32 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "400ms" }} />
              </div>
              {/* Modality badges */}
              <div className="flex items-center gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-6 w-20 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${500 + i * 100}ms` }} />
                ))}
              </div>
              {/* Topic badges */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-6 w-24 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${700 + i * 100}ms` }} />
                ))}
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-4 pt-4">
                <div className="h-10 w-36 rounded-md bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "1000ms" }} />
                <div className="flex items-center gap-2 ml-auto">
                  <div className="h-9 w-20 rounded-md bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "1100ms" }} />
                  <div className="h-9 w-20 rounded-md bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "1200ms" }} />
                </div>
              </div>
            </div>

            {/* Claims skeleton */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border bg-card p-6 space-y-4" style={{ animationDelay: `${i * 200}ms` }}>
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1300 + i * 200}ms` }} />
                      <div className="h-5 w-24 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1400 + i * 200}ms` }} />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1500 + i * 200}ms` }} />
                      <div className="h-4 w-5/6 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1600 + i * 200}ms` }} />
                      <div className="h-4 w-2/3 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1700 + i * 200}ms` }} />
                    </div>
                    <div className="h-3 w-40 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1800 + i * 200}ms` }} />
                  </div>
                ))}
              </div>
              {/* Sidebar skeleton */}
              <div className="space-y-6">
                <div className="rounded-xl border bg-card p-6 space-y-4">
                  <div className="h-5 w-32 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: "1300ms" }} />
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1400 + i * 100}ms` }} />
                        <div className="h-4 w-full rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${1500 + i * 100}ms` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    );
  }

  if (!analysis) return null;

  const statusKey =
    analysis.overall_verdict.toUpperCase() as keyof typeof statusConfig;
  const config = statusConfig[statusKey] || statusConfig["DESCONHECIDO"];
  const StatusIcon = config.icon;

  // Check if all claims have unverifiable verdicts
  const unverifiableVerdicts = new Set(["CHECK", "UNVERIFIED", "DESCONHECIDO", "FONTES INSUFICIENTES PARA VERIFICAR"]);
  const allClaimsUnverified = analysis.claims.length > 0 && analysis.claims.every(
    (claim) => unverifiableVerdicts.has(claim.verdict.toUpperCase())
  );

  const modalityIcons = [];
  if (analysis.media_info.has_audio)
    modalityIcons.push({ icon: Mic, label: "Áudio" });
  if (analysis.media_info.has_image)
    modalityIcons.push({ icon: ImageIcon, label: "Imagem" });
  if (analysis.media_info.has_video)
    modalityIcons.push({ icon: Camera, label: "Vídeo" });
  if (analysis.user_message_text)
    modalityIcons.push({ icon: FileText, label: "Texto" });

  // Coletar todos os tópicos únicos das claims
  const allTopics = Array.from(
    new Set(analysis.claims.flatMap((claim) => claim.topics)),
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <article className="container py-12 max-w-7xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {analysis.analysis_metrics ? (
                <>
                  {analysis.analysis_metrics.true_count > 0 && (
                    <div
                      className="h-4 w-4 rounded-full bg-status-true"
                      title="Contém informações verdadeiras"
                    />
                  )}
                  {analysis.analysis_metrics.fake_count > 0 && (
                    <div
                      className="h-4 w-4 rounded-full bg-status-false"
                      title="Contém informações falsas"
                    />
                  )}
                  {(analysis.analysis_metrics.out_of_context_count || 0) >
                    0 && (
                    <div
                      className="h-4 w-4 rounded-full bg-yellow-500"
                      title="Contém informações fora de contexto"
                    />
                  )}
                  {analysis.analysis_metrics.unverified_count > 0 && (
                    <div
                      className="h-4 w-4 rounded-full bg-status-unverifiable"
                      title="Contém informações não verificáveis"
                    />
                  )}
                </>
              ) : (
                <Badge
                  variant="outline"
                  className={`${config.className} text-base py-1.5 px-4`}
                >
                  <StatusIcon className="h-4 w-4 mr-2" />
                  {config.label}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {analysis.analysis_title || analysis.full_combined_text || "Verificação"}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(analysis.processed_at), "PPP 'às' HH:mm", {
                  locale: ptBR,
                })}
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
                {allTopics.map((topicStr) => {
                  const parts = topicStr.split("|");
                  let name = parts[0];
                  let id = parts.length > 1 ? parts[1] : undefined;

                  // Fallback for legacy data using mapping
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
                        key={topicStr}
                        href={`https://cv.iptc.org/newscodes/mediatopic/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline"
                      >
                        <Badge
                          variant="outline"
                          className="hover:bg-accent transition-colors"
                        >
                          {name}
                        </Badge>
                      </a>
                    );
                  }
                  return (
                    <Badge key={topicStr} variant="outline">
                      {name}
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4 items-center">
              <Button variant="outline" className="gap-2" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>

              <div className="flex items-center gap-2 ml-auto">
                {allClaimsUnverified && currentUser ? (
                  userNeutral ? (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20 gap-1 py-1.5 px-3">
                      <Lightbulb className="h-3.5 w-3.5" /> Neutro — sugerindo fontes
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => setSuggestSourcesInfoOpen(true)}
                    >
                      <Lightbulb className="h-4 w-4" />
                      Sugerir Fontes
                    </Button>
                  )
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Reviewers Modal */}
              {reviewers.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="link"
                      className="p-0 h-auto font-semibold text-primary hover:underline whitespace-normal text-left"
                    >
                      Ver revisores que avaliaram ({reviewers.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Revisores que avaliaram</DialogTitle>
                      <DialogDescription>
                        Estas são as avaliações da análise feita pela AI,
                        realizada pelos revisores certificados do TaCertoIsso
                        AI.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                      {reviewers.map((reviewer) => (
                        <div
                          key={reviewer.uid}
                          className="rounded-lg border bg-card"
                        >
                          <Link
                            to={`/perfil/${reviewer.uid}`}
                            className="flex items-center justify-between p-3 hover:bg-accent transition-colors group rounded-lg"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar className="h-10 w-10 border flex-shrink-0">
                                <AvatarImage
                                  src={getValidPhotoUrl(reviewer.photoURL)}
                                  alt={reviewer.displayName}
                                />
                                <AvatarFallback>
                                  {reviewer.displayName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-sm md:text-base font-medium group-hover:text-accent-foreground transition-colors flex items-center gap-2">
                                  <span className="truncate">
                                    {reviewer.displayName}
                                  </span>
                                  <BadgeCheck className="h-4 w-4 text-primary group-hover:text-accent-foreground flex-shrink-0 transition-colors" />
                                </div>
                                {reviewer.occupation && (
                                  <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/80 truncate transition-colors">
                                    {reviewer.occupation}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground transition-colors" />
                              {reviewer.action === "like" ? (
                                <div className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 group-hover:text-accent-foreground group-hover:bg-white/20 px-2 py-1 rounded-full transition-colors">
                                  <ThumbsUp className="h-3 w-3" />
                                  <span>Aprovou</span>
                                </div>
                              ) : reviewer.action === "neutral" ? (
                                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted group-hover:text-accent-foreground group-hover:bg-white/20 px-2 py-1 rounded-full transition-colors">
                                  <Lightbulb className="h-3 w-3" />
                                  <span>Neutro</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 group-hover:text-accent-foreground group-hover:bg-white/20 px-2 py-1 rounded-full transition-colors">
                                  <ThumbsDown className="h-3 w-3" />
                                  <span>Reprovou</span>
                                </div>
                              )}
                            </div>
                          </Link>
                          {(reviewer.observation || (reviewer.suggested_sources && Object.keys(reviewer.suggested_sources).length > 0)) && (
                            <div className="px-3 pb-3 pt-0 flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingObservation(reviewer);
                                }}
                                className={`text-xs flex items-center gap-1 transition-colors ${(reviewer.has_custom_observation || (reviewer.suggested_sources && Object.keys(reviewer.suggested_sources).length > 0)) ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-primary"}`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                {reviewer.has_custom_observation
                                  ? "Ver observação"
                                  : "Sem observações"}
                              </button>
                              {reviewer.suggested_sources && Object.keys(reviewer.suggested_sources).length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingObservation(reviewer);
                                  }}
                                  className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                                >
                                  <BookOpen className="h-3 w-3" />
                                  {Object.keys(reviewer.suggested_sources).length} fonte(s) sugerida(s)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Observation Input Modal */}
            <Dialog
              open={observationModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setObservationModalOpen(false);
                  setPendingAction(null);
                  setObservationText("");
                }
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {pendingAction === "like"
                      ? "Aprovar análise"
                      : "Reprovar análise"}
                  </DialogTitle>
                  <DialogDescription>
                    Deseja adicionar uma observação à sua avaliação? (opcional)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="observation">Observação</Label>
                  <Textarea
                    id="observation"
                    placeholder="Escreva uma observação (opcional)..."
                    value={observationText}
                    onChange={(e) =>
                      setObservationText(e.target.value.slice(0, 144))
                    }
                    maxLength={144}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {observationText.length}/144
                  </p>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setObservationModalOpen(false);
                      setPendingAction(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmitObservation}
                    disabled={submittingObservation}
                    variant={
                      pendingAction === "like" ? "default" : "destructive"
                    }
                  >
                    {submittingObservation
                      ? "Enviando..."
                      : pendingAction === "like"
                        ? "Aprovar"
                        : "Reprovar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* View Observation Modal */}
            <Dialog
              open={!!viewingObservation}
              onOpenChange={(open) => {
                if (!open) setViewingObservation(null);
              }}
            >
              <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Observação
                  </DialogTitle>
                  <DialogDescription className="sr-only">Detalhes da observação do revisor</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* User + Badge row */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-muted">
                      <AvatarImage src={getValidPhotoUrl(viewingObservation?.photoURL)} />
                      <AvatarFallback>{viewingObservation?.displayName?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link to={`/perfil/${viewingObservation?.uid}`} className="font-medium text-sm truncate hover:underline">
                        {viewingObservation?.displayName || "Usuário"}
                      </Link>
                      {viewingObservation?.occupation && (
                        <div className="text-xs text-muted-foreground truncate">{viewingObservation.occupation}</div>
                      )}
                    </div>
                    <div>
                      {viewingObservation?.action === "like" ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                          <ThumbsUp className="h-3 w-3" /> Aprovou
                        </Badge>
                      ) : viewingObservation?.action === "neutral" ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20 gap-1">
                          <Lightbulb className="h-3 w-3" /> Neutro
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                          <ThumbsDown className="h-3 w-3" /> Reprovou
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Analysis info */}
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Análise avaliada</div>
                    <p className="text-sm font-medium line-clamp-2">{analysis?.analysis_title || "Sem título"}</p>
                    {analysis?.overall_verdict && (
                      <p className="text-xs text-muted-foreground mt-1">{analysis.overall_verdict}</p>
                    )}
                  </div>

                  {/* Observation text */}
                  <div className="bg-secondary/50 rounded-lg p-4 text-sm whitespace-pre-wrap break-words">
                    {viewingObservation?.observation || "Sem observação"}
                  </div>

                  {/* Suggested Sources */}
                  {viewingObservation?.suggested_sources && Object.keys(viewingObservation.suggested_sources).length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Fontes Sugeridas
                      </div>
                      {Object.entries(viewingObservation.suggested_sources).map(([claimId, entry]) => {
                        const claimText = analysis?.claims?.find((c) => c.claim_id === claimId)?.text;
                        return (
                          <div key={claimId} className="rounded-lg border p-3 space-y-2">
                            {claimText && (
                              <p className="text-xs text-muted-foreground italic line-clamp-2">
                                "{claimText}"
                              </p>
                            )}
                            {entry.observation && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Obs:</span> {entry.observation}
                              </p>
                            )}
                            <div className="space-y-1">
                              {entry.items?.map((source, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <ExternalLink className="h-3 w-3 text-primary flex-shrink-0" />
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline truncate"
                                  >
                                    {source.title || source.url}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Suggest Sources Info Modal */}
            <Dialog
              open={suggestSourcesInfoOpen}
              onOpenChange={setSuggestSourcesInfoOpen}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lightbulb className="h-5 w-5 text-primary" />
                    </div>
                    Ajude a verificar esta análise!
                  </DialogTitle>
                  <DialogDescription>
                    Todas as afirmações desta análise possuem fontes insuficientes para verificação. Você pode contribuir sugerindo fontes confiáveis.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Siga os passos abaixo para sugerir fontes:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Encontre a afirmação</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Role para baixo e veja as afirmações analisadas pelo bot nesta verificação.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Clique em "Sugerir Fontes"</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Dentro de cada afirmação, clique no botão <span className="inline-flex items-center gap-1 text-primary font-medium"><BookOpen className="h-3 w-3" />Sugerir Fontes</span> para abrir o formulário.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">3</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Adicione URLs e uma observação</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Insira links de fontes confiáveis e explique por que são relevantes para a verificação da afirmação.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 border border-dashed p-3 flex items-start gap-3">
                    <Search className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Dica:</span> Procure por fontes de veículos de imprensa, órgãos oficiais, ou bases de dados reconhecidas. Quanto mais confiável a fonte, maior o impacto da sua contribuição.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setUserNeutral(true);
                      setSuggestSourcesInfoOpen(false);
                      toast.success("Agora você pode sugerir fontes nas afirmações abaixo. Sua contribuição será registrada ao enviar a primeira fonte.");
                    }}
                    className="gap-2 w-full sm:w-auto"
                    disabled={userNeutral}
                  >
                    {userNeutral ? "Já contribuindo" : "Entendi, vou contribuir"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Métricas de Veracidade */}
          {analysis.analysis_metrics && (
            <Card className="border-none shadow-sm bg-muted/30">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm font-medium mb-2">
                    <span>Nível de Veracidade</span>
                    <span className="text-muted-foreground">
                      {analysis.analysis_metrics.total_claims} afirmações
                      analisadas
                    </span>
                  </div>

                  {/* Barra de Progresso Segmentada */}
                  <div className="h-4 w-full flex rounded-full overflow-hidden bg-secondary">
                    {analysis.analysis_metrics.truth_score > 0 && (
                      <div
                        style={{
                          width: `${analysis.analysis_metrics.truth_score}%`,
                        }}
                        className="h-full bg-status-true"
                        title={`Verdadeiro: ${analysis.analysis_metrics.truth_score}%`}
                      />
                    )}
                    {analysis.analysis_metrics.fake_score > 0 && (
                      <div
                        style={{
                          width: `${analysis.analysis_metrics.fake_score}%`,
                        }}
                        className="h-full bg-status-false"
                        title={`Falso: ${analysis.analysis_metrics.fake_score}%`}
                      />
                    )}
                    {(analysis.analysis_metrics.out_of_context_score || 0) >
                      0 && (
                      <div
                        style={{
                          width: `${analysis.analysis_metrics.out_of_context_score || 0}%`,
                        }}
                        className="h-full bg-yellow-500"
                        title={`Fora de Contexto: ${analysis.analysis_metrics.out_of_context_score || 0}%`}
                      />
                    )}
                    {analysis.analysis_metrics.unverified_score > 0 && (
                      <div
                        style={{
                          width: `${analysis.analysis_metrics.unverified_score}%`,
                        }}
                        className="h-full bg-status-unverifiable"
                        title={`Fontes insuficientes para verificar: ${analysis.analysis_metrics.unverified_score}%`}
                      />
                    )}
                  </div>

                  {/* Legenda e Contadores */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                      <span className="text-xl md:text-2xl font-bold text-status-true">
                        {analysis.analysis_metrics.true_count}
                      </span>
                      <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Verdadeiras
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground mt-1">
                        {analysis.analysis_metrics.truth_score}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                      <span className="text-xl md:text-2xl font-bold text-status-false">
                        {analysis.analysis_metrics.fake_count}
                      </span>
                      <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Falsas
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground mt-1">
                        {analysis.analysis_metrics.fake_score}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                      <span className="text-xl md:text-2xl font-bold text-yellow-500">
                        {analysis.analysis_metrics.out_of_context_count || 0}
                      </span>
                      <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Fora de Contexto
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground mt-1">
                        {analysis.analysis_metrics.out_of_context_score || 0}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-background border shadow-sm">
                      <span className="text-xl md:text-2xl font-bold text-status-unverifiable">
                        {analysis.analysis_metrics.unverified_count}
                      </span>
                      <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Não Verificadas
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground mt-1">
                        {analysis.analysis_metrics.unverified_score}%
                      </span>
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
                <h4 className="font-semibold text-sm mb-1">
                  Mensagem Original
                </h4>
                <div className="text-foreground break-words">
                  <MarkdownText
                    text={translateContentTags(
                      normalizeMarkdown(analysis.user_message_text || ""),
                    )}
                  />
                </div>
              </div>

              {analysis.media_info.has_audio &&
                analysis.media_info.audio_text && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      Transcrição do Áudio
                    </h4>
                    <div className="text-sm text-muted-foreground break-words">
                      <MarkdownText
                        text={translateContentTags(
                          normalizeMarkdown(analysis.media_info.audio_text),
                        )}
                      />
                    </div>
                  </div>
                )}

              {analysis.media_info.has_image &&
                analysis.media_info.image_text && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      Texto da Imagem
                    </h4>
                    <div className="text-sm text-muted-foreground break-words">
                      <MarkdownText
                        text={translateContentTags(
                          normalizeMarkdown(analysis.media_info.image_text),
                        )}
                      />
                    </div>
                  </div>
                )}

              {analysis.media_info.has_video &&
                analysis.media_info.video_text && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      Texto do Vídeo
                    </h4>
                    <div className="text-sm text-muted-foreground break-words">
                      <MarkdownText
                        text={translateContentTags(
                          normalizeMarkdown(analysis.media_info.video_text),
                        )}
                      />
                    </div>
                  </div>
                )}

              {analysis.scraped_links.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    Links Encontrados
                  </h4>
                  <div className="space-y-2">
                    {analysis.scraped_links.map((link, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-3 bg-muted/30"
                      >
                        <div className="flex flex-col gap-3">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium hover:underline text-primary break-all"
                          >
                            <LinkIcon className="h-3 w-3 flex-shrink-0" />
                            <span>{link.title || link.url}</span>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (link.scraped_text) {
                                setSelectedLink(link);
                                setLinkModalOpen(true);
                              } else if (!scrapedTextsLoaded) {
                                try {
                                  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
                                  const res = await fetch(`${apiUrl}/analises/${id}/scraped-text`);
                                  if (res.ok) {
                                    const result = await res.json();
                                    const scraped = result.data?.scraped_links || [];
                                    // Update all links in the analysis with their scraped_text
                                    if (analysis) {
                                      const updated = { ...analysis };
                                      updated.scraped_links = updated.scraped_links.map((l) => {
                                        const match = scraped.find((s: ScrapedLink) => s.url === l.url);
                                        return match ? { ...l, scraped_text: match.scraped_text } : l;
                                      });
                                      setAnalysis(updated);
                                      setScrapedTextsLoaded(true);
                                      const matchedLink = updated.scraped_links.find((l) => l.url === link.url);
                                      if (matchedLink?.scraped_text) {
                                        setSelectedLink(matchedLink);
                                        setLinkModalOpen(true);
                                      } else {
                                        toast.info("Nenhum texto raspado disponível para este link.");
                                      }
                                    }
                                  }
                                } catch {
                                  toast.error("Erro ao carregar texto raspado.");
                                }
                              } else {
                                toast.info("Nenhum texto raspado disponível para este link.");
                              }
                            }}
                            className="gap-2 w-full sm:w-auto"
                          >
                            <Eye className="h-3 w-3" />
                            Ver Scraped Text
                          </Button>
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
            <h2 className="text-2xl font-semibold mb-4">
              Afirmações Verificadas
            </h2>
            <div className="space-y-4">
              {analysis.claims.map((claim) => (
                <ClaimCard
                  key={claim.claim_id}
                  claim={claim}
                  suggestedSources={suggestedSourcesByClaim[claim.claim_id] || []}
                  canSuggestSources={!!(currentUser && (userLiked || userDisliked || userNeutral))}
                  currentUserUid={currentUser?.uid}
                  onSuggestSources={handleSuggestSources}
                  onDeleteSuggestedSources={handleDeleteSuggestedSources}
                />
              ))}
            </div>
          </div>

          {/* Resposta Final */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <h2 className="text-xl md:text-2xl font-semibold">Conclusão</h2>
            </CardHeader>
            <CardContent>
              <div className="text-sm md:text-lg font-medium text-foreground">
                <ReactMarkdown
                  components={{
                    p: ({ node, children, ...props }) => {
                      return (
                        <p {...props} className="mb-4 last:mb-0">
                          {Array.isArray(children)
                            ? children.map((child, index) => {
                                if (typeof child === "string") {
                                  // Regex para capturar citações como [1], [1][2], etc.
                                  const parts = child.split(/(\[[0-9]+\])/g);
                                  return parts.map((part, i) => {
                                    if (part.match(/^\[[0-9]+\]$/)) {
                                      const id = part.replace(/[\[\]]/g, "");
                                      return (
                                        <a
                                          key={`${index}-${i}`}
                                          href={`#source-${id}`}
                                          className="text-primary font-bold hover:underline cursor-pointer"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setAccordionValue("sources");
                                            setTimeout(() => {
                                              document
                                                .getElementById(`source-${id}`)
                                                ?.scrollIntoView({
                                                  behavior: "smooth",
                                                });
                                            }, 100);
                                          }}
                                        >
                                          {part}
                                        </a>
                                      );
                                    }
                                    return part;
                                  });
                                }
                                return child;
                              })
                            : children}
                        </p>
                      );
                    },
                  }}
                >
                  {analysis.final_comment}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Fontes de Apoio */}
          {(() => {
            // Aggregate all unique sources from claims
            const allSources = analysis.claims.flatMap(
              (claim) => claim.sources,
            );
            const uniqueSources = Array.from(
              new Map(allSources.map((s) => [s.url, s])).values(),
            );

            if (uniqueSources.length === 0) return null;

            return (
              <Accordion
                type="single"
                collapsible
                className="w-full border-2 border-muted rounded-lg bg-card text-card-foreground shadow-sm"
                value={accordionValue}
                onValueChange={setAccordionValue}
              >
                <AccordionItem value="sources" className="border-none">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <h2 className="text-xl md:text-2xl font-semibold">
                      Fontes de Apoio
                    </h2>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-3 pt-2">
                      {uniqueSources.map((source, index) => (
                        <div
                          key={index}
                          id={`source-${index + 1}`}
                          className="flex gap-3 text-sm"
                        >
                          <span className="font-bold text-primary min-w-[24px]">
                            [{index + 1}]
                          </span>
                          <div className="flex-1">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline text-foreground block"
                            >
                              {source.title ||
                                source.publisher ||
                                new URL(source.url).hostname}
                            </a>
                            <span className="text-xs text-muted-foreground break-all">
                              {source.url}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })()}
        </div>

        {/* Seção de Recomendações */}
        {analysis && (
          <RecommendationsSection documentId={analysis.document_id} />
        )}
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
