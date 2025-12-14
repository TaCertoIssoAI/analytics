import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Analysis, Claim, VerificationResult } from "@/types/analysis";
import { translateContentTags } from "@/lib/translateContentTags";
import {
  Camera,
  CheckCircle,
  ExternalLink,
  HelpCircle,
  Home,
  Loader2,
  Mic,
  Image as ImageIcon,
  MessageSquare,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type AnaliseGetResponse =
  | { success: true; data: Analysis; message?: string }
  | { success: false; data?: unknown; message?: string };

function getVerdictUi(verdictRaw: string | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  Icon: typeof CheckCircle;
} {
  const verdict = (verdictRaw ?? "").toUpperCase();

  if (verdict === "VERDADEIRO") {
    return { label: "Verdadeiro", variant: "default", Icon: CheckCircle };
  }

  if (verdict === "FALSO") {
    return { label: "Falso", variant: "destructive", Icon: XCircle };
  }

  return { label: "Inverificável", variant: "secondary", Icon: HelpCircle };
}

function claimVerdictLabel(verdict: VerificationResult): string {
  switch (verdict) {
    case "VERDADEIRO":
      return "Verdadeiro";
    case "FALSO":
      return "Falso";
    case "ENGANOSO":
      return "Enganoso";
    case "FORA_DE_CONTEXTO":
      return "Fora de contexto";
    case "CHECK":
      return "Checagem";
    case "UNVERIFIED":
      return "Inverificável";
    default:
      return verdict;
  }
}

const Verification = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!id) {
      navigate("/verificacao-nao-encontrada", { replace: true });
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}/analises/${encodeURIComponent(id)}`);

        if (response.status === 404) {
          navigate(`/verificacao-nao-encontrada/${encodeURIComponent(id)}`, { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(`Falha ao carregar verificação (HTTP ${response.status})`);
        }

        const result: AnaliseGetResponse = await response.json();

        if (!result.success || !("data" in result) || !result.data) {
          throw new Error("Resposta inválida do servidor");
        }

        if (!cancelled) {
          setAnalysis(result.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro desconhecido");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, id, navigate]);

  const verdictUi = useMemo(() => getVerdictUi(analysis?.overall_verdict), [analysis?.overall_verdict]);

  const userMessageText = useMemo(() => {
    const raw = analysis?.user_message_text;
    return typeof raw === "string" ? raw.trim() : "";
  }, [analysis?.user_message_text]);

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

  const userMessageDisplay = useMemo(() => translateContentTags(userMessageText), [userMessageText]);

  const audioTextRaw = useMemo(() => {
    const raw = analysis?.media_info?.audio_text;
    return typeof raw === "string" ? raw.trim() : "";
  }, [analysis?.media_info?.audio_text]);

  const imageTextRaw = useMemo(() => {
    const raw = analysis?.media_info?.image_text;
    return typeof raw === "string" ? raw.trim() : "";
  }, [analysis?.media_info?.image_text]);

  const videoTextRaw = useMemo(() => {
    const raw = analysis?.media_info?.video_text;
    return typeof raw === "string" ? raw.trim() : "";
  }, [analysis?.media_info?.video_text]);

  const combinedTextRaw = useMemo(() => {
    const raw = analysis?.full_combined_text;
    return typeof raw === "string" ? raw.trim() : "";
  }, [analysis?.full_combined_text]);

  const hasAnyMedia = Boolean(
    analysis?.media_info?.has_audio || analysis?.media_info?.has_image || analysis?.media_info?.has_video
  );

  const mediaFlagsCount =
    Number(Boolean(analysis?.media_info?.has_audio)) +
    Number(Boolean(analysis?.media_info?.has_image)) +
    Number(Boolean(analysis?.media_info?.has_video));

  const audioMarkdown = useMemo(() => {
    const candidate =
      audioTextRaw ||
      (mediaFlagsCount === 1 && analysis?.media_info?.has_audio ? combinedTextRaw : "");
    return translateContentTags(normalizeMarkdown(candidate));
  }, [analysis?.media_info?.has_audio, audioTextRaw, combinedTextRaw, mediaFlagsCount]);

  const imageMarkdown = useMemo(() => {
    const candidate =
      imageTextRaw ||
      (mediaFlagsCount === 1 && analysis?.media_info?.has_image ? combinedTextRaw : "");
    return translateContentTags(normalizeMarkdown(candidate));
  }, [analysis?.media_info?.has_image, imageTextRaw, combinedTextRaw, mediaFlagsCount]);

  const videoMarkdown = useMemo(() => {
    const candidate =
      videoTextRaw ||
      (mediaFlagsCount === 1 && analysis?.media_info?.has_video ? combinedTextRaw : "");
    return translateContentTags(normalizeMarkdown(candidate));
  }, [analysis?.media_info?.has_video, videoTextRaw, combinedTextRaw, mediaFlagsCount]);

  const combinedMarkdown = useMemo(() => {
    // Se já mostramos texto específico de mídia, evita duplicar o combinado.
    if (!combinedTextRaw) return "";
    if (!hasAnyMedia) return "";
    if (mediaFlagsCount <= 1) return "";
    if (audioTextRaw || imageTextRaw || videoTextRaw) return "";
    return translateContentTags(normalizeMarkdown(combinedTextRaw));
  }, [audioTextRaw, combinedTextRaw, hasAnyMedia, imageTextRaw, mediaFlagsCount, videoTextRaw]);

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

  const topics = useMemo(() => {
    if (!analysis) return [] as string[];
    return Array.from(new Set(analysis.claims.flatMap((c) => c.topics ?? [])));
  }, [analysis]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 md:py-24">
          <Card className="max-w-3xl mx-auto">
            <CardContent className="pt-12 pb-12 text-center space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Carregando verificação…</h1>
                <p className="text-sm text-muted-foreground">ID: {id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 md:py-24">
          <Card className="max-w-3xl mx-auto">
            <CardContent className="pt-12 pb-12 text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Não foi possível carregar</h1>
                <p className="text-sm text-muted-foreground">{error ?? "Verificação indisponível"}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild>
                  <Link to="/" className="gap-2">
                    <Home className="h-4 w-4" />
                    Início
                  </Link>
                </Button>
                {id && (
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Tentar novamente
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-8 md:py-12 space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{analysis.analysis_title ?? "Verificação"}</CardTitle>
                <p className="text-sm text-muted-foreground">ID: {analysis.document_id}</p>
              </div>

              <div className="flex items-center gap-2">
                <verdictUi.Icon className="h-5 w-5" />
                <Badge variant={verdictUi.variant}>{verdictUi.label}</Badge>
              </div>
            </div>

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topics.slice(0, 12).map((t) => (
                  <Badge key={t} variant="outline">
                    {t.split("|")[0]}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {userMessageDisplay && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Mensagem analisada
                </div>
                <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
                  {userMessageDisplay}
                </div>
              </div>
            )}

            {(audioMarkdown || imageMarkdown || videoMarkdown || combinedMarkdown) && (
              <div className="space-y-4">
                {audioMarkdown && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      Transcrição do áudio
                    </div>
                    <div className="rounded-lg border bg-card p-4 break-words">
                      <MarkdownText text={audioMarkdown} />
                    </div>
                  </div>
                )}

                {imageMarkdown && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      Descrição da imagem
                    </div>
                    <div className="rounded-lg border bg-card p-4 break-words">
                      <MarkdownText text={imageMarkdown} />
                    </div>
                  </div>
                )}

                {videoMarkdown && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      Descrição completa do vídeo
                    </div>
                    <div className="rounded-lg border bg-card p-4 break-words">
                      <MarkdownText text={videoMarkdown} />
                    </div>
                  </div>
                )}

                {combinedMarkdown && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Conteúdo extraído
                    </div>
                    <div className="rounded-lg border bg-card p-4 break-words">
                      <MarkdownText text={combinedMarkdown} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Conclusão</div>
              <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">{analysis.final_comment}</div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-medium">Afirmações ({analysis.claims.length})</div>
              <div className="space-y-3">
                {analysis.claims.map((claim: Claim) => {
                  const claimUi = getVerdictUi(claim.verdict);

                  return (
                    <Card key={claim.claim_id}>
                      <CardContent className="pt-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="font-medium">{claim.text}</div>
                          <div className="flex items-center gap-2">
                            <claimUi.Icon className="h-4 w-4" />
                            <Badge variant={claimUi.variant}>{claimVerdictLabel(claim.verdict)}</Badge>
                          </div>
                        </div>

                        {claim.reasoning && (
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{claim.reasoning}</div>
                        )}

                        {claim.sources?.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Fontes
                            </div>
                            <div className="space-y-1">
                              {claim.sources.slice(0, 8).map((s) => (
                                <a
                                  key={s.url}
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  <span className="truncate">{s.title ?? s.url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Verification;
