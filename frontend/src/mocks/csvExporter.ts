import type { Analysis } from "@/types/analysis";

export interface DashboardExportData {
  total_messages: number;
  total_claims: number;
  total_out_of_context_claims: number;
  results_distribution: Array<{ name: string; value: number }>;
  modalities_distribution: Array<{ name: string; value: number }>;
}

function csvEscapeMinimal(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvEscapeAll(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function escapeNewlines(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\\n");
}

function normalizeClaimVerdict(verdict?: string): string {
  const v = (verdict || "").toUpperCase().trim();
  if (v.includes("VERDADEIRO") || v === "TRUE") return "VERDADEIRO";
  if (v.includes("FALSO") || v === "FALSE" || v.includes("FAKE")) return "FALSO";
  if (
    v.includes("FORA_DE_CONTEXTO") ||
    v.includes("FORA DE CONTEXTO") ||
    v.includes("OUT_OF_CONTEXT") ||
    v.includes("OUT OF CONTEXT")
  ) {
    return "FORA_DE_CONTEXTO";
  }
  return "UNVERIFIED";
}

function verdictLabel(verdict?: string): string {
  const norm = normalizeClaimVerdict(verdict);
  if (norm === "VERDADEIRO") return "Verdadeiro";
  if (norm === "FALSO") return "Falso";
  if (norm === "FORA_DE_CONTEXTO") return "Fora de Contexto";
  return "Fontes insuficientes para verificar";
}

function formatDateBr(dateValue: string): string {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function buildDashboardCsv(data: DashboardExportData): string {
  const rows: Array<[string, string | number]> = [
    ["Métrica", "Valor"],
    ["Total de Mensagens", data.total_messages],
    ["Total de Afirmações", data.total_claims],
    ["Total de Afirmações Fora de Contexto", data.total_out_of_context_claims || 0],
  ];

  let totalTrue = 0;
  let totalFake = 0;
  let totalUnknown = 0;

  for (const item of data.results_distribution) {
    if (item.name === "Verdadeiro") totalTrue = item.value;
    else if (item.name === "Falso") totalFake = item.value;
    else if (item.name === "Fontes insuficientes para verificar") totalUnknown = item.value;
  }

  rows.push(["Total Verdadeiras", totalTrue]);
  rows.push(["Total Falsas", totalFake]);
  rows.push(["Total Fontes Insuficientes", totalUnknown]);

  for (const item of data.results_distribution) {
    rows.push([`Afirmações ${item.name}`, item.value]);
  }
  for (const item of data.modalities_distribution) {
    rows.push([`Mensagens com ${item.name}`, item.value]);
  }

  return rows.map((r) => r.map(csvEscapeMinimal).join(",")).join("\r\n");
}

export function buildMessagesCsv(items: Analysis[]): string {
  const header = [
    "Data",
    "Tipo",
    "Título",
    "Número de afirmações",
    "Resultado",
    "Tópicos",
    "Conteúdo",
    "Afirmações verificadas",
    "Conclusão",
  ];

  const lines: string[] = [header.map(csvEscapeAll).join(",")];

  for (const item of items) {
    const metrics = item.analysis_metrics;
    let cTrue = 0;
    let cFake = 0;
    let cUnv = 0;
    let cOoc = 0;

    if (metrics) {
      cTrue = metrics.true_count || 0;
      cFake = metrics.fake_count || 0;
      cUnv = metrics.unverified_count || 0;
      cOoc = metrics.out_of_context_count || 0;
    } else {
      for (const c of item.claims || []) {
        const vn = normalizeClaimVerdict(c.verdict);
        if (vn === "VERDADEIRO") cTrue++;
        else if (vn === "FALSO") cFake++;
        else if (vn === "FORA_DE_CONTEXTO") cOoc++;
        else cUnv++;
      }
    }

    const resultStr = [
      `Verdadeiro: ${cTrue}`,
      `Falso: ${cFake}`,
      `Fontes insuficientes para verificar: ${cUnv}`,
      `Fora de Contexto: ${cOoc}`,
    ].join("\n");

    const topicsSet = new Set<string>();
    for (const c of item.claims || []) {
      for (const t of c.topics || []) {
        const clean = typeof t === "string" && t.includes("|") ? t.split("|")[0] : t;
        if (clean) topicsSet.add(clean);
      }
    }
    const topicsStr = Array.from(topicsSet).sort().join(", ");

    const contentParts: string[] = [];
    if (item.user_message_text?.trim()) {
      contentParts.push(`Mensagem Original:\n${item.user_message_text.trim()}`);
    }
    if (item.media_info?.has_audio && item.media_info.audio_text?.trim()) {
      contentParts.push(`Transcrição do Áudio:\n${item.media_info.audio_text.trim()}`);
    }
    if (item.media_info?.has_image && item.media_info.image_text?.trim()) {
      contentParts.push(`Texto da Imagem:\n${item.media_info.image_text.trim()}`);
    }
    if (item.media_info?.has_video && item.media_info.video_text?.trim()) {
      contentParts.push(`Texto do Vídeo:\n${item.media_info.video_text.trim()}`);
    }
    const contentStr = contentParts.join("\n\n");

    const claimBlocks = (item.claims || []).map((c, idx) => {
      const sourceLines = (c.sources || []).map((s) => {
        let line = "- ";
        if (s.publisher?.trim()) line += `[${s.publisher.trim()}] `;
        if (s.title?.trim()) line += `${s.title.trim()} `;
        if (s.url?.trim()) line += `(${s.url.trim()})`;
        if (s.citation_text?.trim()) line += `\n  Citação: ${s.citation_text.trim()}`;
        return line;
      });
      const sourcesBlock = sourceLines.length ? sourceLines.join("\n") : "Nenhuma fonte citada.";
      return [
        `Afirmação #${idx + 1}:`,
        `Texto: ${(c.text || "").trim()}`,
        `Veredito: ${verdictLabel(c.verdict)}`,
        c.reasoning?.trim() ? `Justificativa: ${c.reasoning.trim()}` : "",
        `Fontes:\n${sourcesBlock}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    });
    const claimsStr = claimBlocks.join("\n\n----------------------------------------\n\n");

    const row = [
      escapeNewlines(formatDateBr(item.processed_at)),
      escapeNewlines(item.source_type === "FromWhatsappGroup" ? "WhatsApp" : "Direta"),
      escapeNewlines(item.analysis_title || "Sem título"),
      escapeNewlines(String((item.claims || []).length)),
      escapeNewlines(resultStr),
      escapeNewlines(topicsStr),
      escapeNewlines(contentStr),
      escapeNewlines(claimsStr),
      escapeNewlines(item.final_comment || ""),
    ];
    lines.push(row.map(csvEscapeAll).join(","));
  }

  return lines.join("\r\n");
}

export function buildSourcesCsv(items: Array<{ source: string; count: number }>): string {
  const lines = [["URL da Fonte", "Número de Citações"].map(csvEscapeMinimal).join(",")];
  for (const item of items) {
    lines.push([item.source, item.count].map(csvEscapeMinimal).join(","));
  }
  return lines.join("\r\n");
}
