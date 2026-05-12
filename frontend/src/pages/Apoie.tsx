import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Heart,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  ShieldCheck,
} from "lucide-react";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface DonationLog {
  date: string;
  amount_brl: number;
  markdown: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

interface DonationStats {
  total_brl: number;
  days_count: number;
  last_update: string | null;
}

interface LogsResponse {
  items: DonationLog[];
  total: number;
  has_more: boolean;
}

const PIX_KEY = "tacertoissoai@gmail.com";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDatePtBr = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map((p) => parseInt(p, 10));
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTimestamp = (iso: string | null) => {
  if (!iso) return "Sem registro";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
};

const markdownComponents = {
  h1: (props: any) => <h3 className="text-base font-semibold mt-2" {...props} />,
  h2: (props: any) => <h4 className="text-sm font-semibold mt-2" {...props} />,
  h3: (props: any) => <h5 className="text-sm font-semibold mt-2" {...props} />,
  p: (props: any) => <p className="leading-relaxed mb-2" {...props} />,
  ul: (props: any) => <ul className="list-disc pl-5 space-y-1 mb-2" {...props} />,
  ol: (props: any) => <ol className="list-decimal pl-5 space-y-1 mb-2" {...props} />,
  li: (props: any) => <li className="leading-relaxed" {...props} />,
  strong: (props: any) => <strong className="font-semibold" {...props} />,
  em: (props: any) => <em className="italic" {...props} />,
  code: (props: any) => (
    <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props} />
  ),
  pre: (props: any) => (
    <pre className="overflow-x-auto rounded bg-muted p-3 text-xs" {...props} />
  ),
  a: (props: any) => (
    <a
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
};

const Apoie = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "transparencia" ? "transparencia" : "apoiar";
  const [tab, setTab] = useState<string>(initialTab);

  const onTabChange = (value: string) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === "transparencia") next.set("tab", "transparencia");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  // --- PIX copy ---
  const [copied, setCopied] = useState(false);
  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success("Chave Pix copiada!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar a chave.");
    }
  };

  // --- Transparency state ---
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [logs, setLogs] = useState<DonationLog[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const LIMIT = 20;

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${apiUrl}/donations/stats`);
      const j = await r.json();
      if (j?.success && j.data) setStats(j.data as DonationStats);
    } catch (e) {
      console.error("Erro ao buscar stats:", e);
    }
  }, [apiUrl]);

  const fetchLogs = useCallback(
    async (range: { start: string; end: string }, nextOffset: number, append: boolean) => {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(nextOffset));
      if (range.start) params.set("start", range.start);
      if (range.end) params.set("end", range.end);

      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const r = await fetch(`${apiUrl}/donations/logs?${params.toString()}`);
        const j = await r.json();
        if (j?.success && j.data) {
          const data = j.data as LogsResponse;
          setLogs((prev) => (append ? [...prev, ...data.items] : data.items));
          setHasMore(data.has_more);
          setOffset(nextOffset + data.items.length);
        }
      } catch (e) {
        console.error("Erro ao buscar logs:", e);
        toast.error("Erro ao buscar diário de bordo.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    fetchStats();
    fetchLogs({ start: "", end: "" }, 0, false);
  }, [fetchStats, fetchLogs]);

  const applyFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      toast.error("Data inicial maior que a final.");
      return;
    }
    const range = { start: startDate, end: endDate };
    setAppliedRange(range);
    setOffset(0);
    fetchLogs(range, 0, false);
  };

  const clearFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedRange({ start: "", end: "" });
    setOffset(0);
    fetchLogs({ start: "", end: "" }, 0, false);
  };

  const loadMore = () => {
    fetchLogs(appliedRange, offset, true);
  };

  const toggleExpanded = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const totalDisplay = useMemo(() => formatBRL(stats?.total_brl ?? 0), [stats]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container px-4 sm:px-6 lg:px-8 pt-8 md:pt-14 pb-6 md:pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="shrink-0 p-2 rounded-full bg-primary/10">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
              Apoie o projeto
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight max-w-3xl">
            Ajude a manter o <span className="text-primary">Tá Certo Isso AI?</span> no ar
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-3xl">
            Combatemos desinformação no WhatsApp brasileiro de forma independente, sem patrocínio.
            Sua contribuição mantém o projeto vivo até as eleições de 2026.
          </p>
        </div>
      </section>

      <section className="container px-4 sm:px-6 lg:px-8 pt-4 pb-10">
        <Tabs value={tab} onValueChange={onTabChange} className="w-full">
          <TabsList className="grid h-auto min-h-10 w-full max-w-md grid-cols-2">
            <TabsTrigger value="apoiar" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <Heart className="h-4 w-4" /> Apoiar
            </TabsTrigger>
            <TabsTrigger value="transparencia" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <ShieldCheck className="h-4 w-4" /> Transparência
            </TabsTrigger>
          </TabsList>

          {/* ============================ APOIAR ============================ */}
          <TabsContent value="apoiar" className="mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5 text-base leading-relaxed">
                <p>
                  O <strong>Tá Certo Isso AI?</strong> é um projeto <strong>independente</strong>{" "}
                  que combate desinformação no WhatsApp brasileiro. Hoje funcionamos sem
                  patrocínio e precisamos da sua ajuda para continuar no ar.
                </p>
                <p>
                  Estamos buscando outras formas estáveis de financiamento e parcerias, mas, neste
                  momento inicial, sua contribuição faz toda a diferença para mantermos a
                  infraestrutura, a equipe e o atendimento ao público.
                </p>
                <p>
                  Nosso objetivo é <strong>escalar a operação para reforçar o compromisso com a
                  verdade nas eleições de 2026</strong>, um ano decisivo para o futuro do nosso
                  país. Cada apoio nos aproxima desse objetivo.
                </p>
                <p className="text-sm text-muted-foreground">
                  Toda a movimentação da vaquinha é registrada na aba{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => onTabChange("transparencia")}
                  >
                    Transparência
                  </button>
                  .
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" />
                    Contribuir via Pix
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Chave Pix (e-mail)
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
                        {PIX_KEY}
                      </code>
                      <Button onClick={copyPix} variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 self-start">
                      QR Code
                    </div>
                    <img
                      src="/pix-tacertoissoai.JPG"
                      alt="QR Code Pix Tá Certo Isso AI"
                      className="h-auto w-full max-w-64 object-contain rounded-lg border bg-white p-2"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Após contribuir, o lançamento aparecerá na aba Transparência no fechamento do dia.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ======================= TRANSPARÊNCIA ======================= */}
          <TabsContent value="transparencia" className="mt-8 space-y-6">
            <Card>
              <CardContent className="py-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Total Arrecadado
                    </div>
                    <div className="mt-1 break-words text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
                      {totalDisplay}
                    </div>
                  </div>
                  <div className="min-w-0 border-t pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Dias com lançamento
                    </div>
                    <div className="text-2xl font-semibold mt-1">
                      {stats?.days_count ?? 0}
                    </div>
                  </div>
                  <div className="min-w-0 border-t pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Última atualização
                    </div>
                    <div className="mt-1 break-words text-sm">{formatTimestamp(stats?.last_update ?? null)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 shrink-0" />
                  Filtrar diário de bordo
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <form
                  className="min-w-0 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    applyFilter();
                  }}
                >
                  <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                    <div className="min-w-0 rounded-md border bg-background p-3">
                      <label
                        htmlFor="donation-start-date"
                        className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        Início
                      </label>
                      <Input
                        id="donation-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="min-w-0 max-w-full appearance-none text-base [min-inline-size:0]"
                      />
                    </div>
                    <div className="min-w-0 rounded-md border bg-background p-3">
                      <label
                        htmlFor="donation-end-date"
                        className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        Fim
                      </label>
                      <Input
                        id="donation-end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="min-w-0 max-w-full appearance-none text-base [min-inline-size:0]"
                      />
                    </div>
                    <div className="grid min-w-0 grid-cols-2 gap-2 md:col-span-2 xl:col-span-1 xl:w-auto">
                      <Button type="submit" disabled={loading} className="w-full">
                        Filtrar
                      </Button>
                      <Button type="button" onClick={clearFilter} variant="outline" disabled={loading} className="w-full">
                        Limpar
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h2 className="text-xl font-bold">Diário de bordo</h2>
              <p className="text-sm text-muted-foreground">
                Cada lançamento é uma “nota fiscal” diária registrada pela administração.
              </p>

              {loading && logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Carregando…</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum lançamento encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => {
                    const isOpen = expanded.has(log.date);
                    return (
                      <Card key={log.date}>
                        <CardContent className="py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm text-muted-foreground">
                                {formatDatePtBr(log.date)}
                              </div>
                              <div className="break-words text-xl font-bold text-green-600 dark:text-green-400 sm:text-2xl">
                                {formatBRL(log.amount_brl)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(log.date)}
                              className="w-full justify-center gap-1 sm:w-auto"
                            >
                              {isOpen ? "Ocultar nota" : "Ver nota fiscal"}
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {isOpen && (
                            <div className="mt-4 overflow-hidden border-t pt-4 text-sm">
                              <ReactMarkdown components={markdownComponents}>
                                {log.markdown}
                              </ReactMarkdown>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {hasMore && (
                    <div className="text-center pt-4">
                      <Button
                        variant="outline"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full sm:w-auto"
                      >
                        {loadingMore ? "Carregando…" : "Carregar mais"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default Apoie;
