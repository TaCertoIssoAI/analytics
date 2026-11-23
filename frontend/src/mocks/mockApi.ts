import { MOCK_API_BASE, simulateNetworkDelay } from "./config";
import { buildDashboardCsv, buildMessagesCsv, buildSourcesCsv } from "./csvExporter";
import { extractUidFromAuthHeader } from "./mockAuth";
import {
  getAnalysisById,
  getMergedAllAnalyses,
  getMergedDonations,
  getMergedRecentAnalyses,
  getMergedUsers,
  getUserById,
  loadOverlay,
  loadScrapedTexts,
  loadStatsFile,
  loadTopSourcesFile,
  saveOverlay,
  setNativeFetch,
  type MockAnalysis,
  type MockObservation,
  type MockUser,
} from "./mockStore";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function csvResponse(csvText: string, filename: string): Response {
  return new Response(csvText, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}

function normalizeText(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseBoolParam(params: URLSearchParams, key: string, defaultValue = true): boolean {
  const val = params.get(key);
  if (val === null) return defaultValue;
  return val.toLowerCase() !== "false" && val !== "0";
}

function parseIntParam(params: URLSearchParams, key: string, defaultValue: number): number {
  const val = params.get(key);
  if (val === null) return defaultValue;
  const n = Number.parseInt(val, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function isUnfilteredParams(params: URLSearchParams): boolean {
  if ((params.get("search") || "").trim()) return false;
  if (params.get("start_date") || params.get("end_date")) return false;
  if (!parseBoolParam(params, "message_type_whatsapp", true)) return false;
  if (!parseBoolParam(params, "message_type_direct", true)) return false;
  if (!parseBoolParam(params, "modality_text", true)) return false;
  if (!parseBoolParam(params, "modality_audio", true)) return false;
  if (!parseBoolParam(params, "modality_video", true)) return false;
  if (!parseBoolParam(params, "modality_image", true)) return false;
  if (parseIntParam(params, "min_truth_score", 0) > 0) return false;
  if (parseIntParam(params, "max_truth_score", 100) < 100) return false;
  if (parseIntParam(params, "min_fake_score", 0) > 0) return false;
  if (parseIntParam(params, "max_fake_score", 100) < 100) return false;
  if (parseIntParam(params, "min_unverified_score", 0) > 0) return false;
  if (parseIntParam(params, "max_unverified_score", 100) < 100) return false;
  if (parseIntParam(params, "min_out_of_context_score", 0) > 0) return false;
  if (parseIntParam(params, "max_out_of_context_score", 100) < 100) return false;
  return true;
}

function resolveDateBounds(
  params: URLSearchParams,
  latestProcessedAt: string
): { startMs: number | null; endMs: number | null } {
  const rawStart = params.get("start_date");
  const rawEnd = params.get("end_date");
  let startMs = rawStart ? Date.parse(rawStart) : null;
  let endMs = rawEnd ? Date.parse(rawEnd) : null;
  if (startMs !== null && Number.isNaN(startMs)) startMs = null;
  if (endMs !== null && Number.isNaN(endMs)) endMs = null;

  // Anchor relative presets (last24h / last7d / last30d) to the snapshot's
  // latest analysis timestamp so they always yield authentic results while
  // keeping historical timestamps intact on every card.
  if (startMs !== null && endMs !== null && latestProcessedAt) {
    const nowMs = Date.now();
    const latestMs = Date.parse(latestProcessedAt);
    const delta = endMs - startMs;
    const isNearNow = Math.abs(nowMs - endMs) < 5 * 60 * 1000;
    const presetWindows = [
      24 * 60 * 60 * 1000,
      7 * 24 * 60 * 60 * 1000,
      30 * 24 * 60 * 60 * 1000,
    ];
    const matchesPreset = presetWindows.some((w) => Math.abs(delta - w) < 120 * 1000);

    if (isNearNow && matchesPreset && !Number.isNaN(latestMs) && latestMs < nowMs) {
      endMs = latestMs;
      startMs = latestMs - delta;
    }
  }

  return { startMs, endMs };
}

function scoreSearchMatch(item: MockAnalysis, rawQuery: string): number {
  const q = normalizeText(rawQuery.trim());
  if (!q) return 1;

  if (normalizeText(item.document_id) === q) return 1000;

  const title = normalizeText(item.analysis_title || "");
  const message = normalizeText(item.user_message_text || "");
  const comment = normalizeText(item.final_comment || "");
  const mediaText = normalizeText(
    [
      item.media_info?.audio_text || "",
      item.media_info?.image_text || "",
      item.media_info?.video_text || "",
    ].join(" ")
  );
  const claimsText = normalizeText(
    (item.claims || []).map((c) => `${c.text} ${c.reasoning}`).join(" ")
  );
  const topicsText = normalizeText(
    (item.claims || []).flatMap((c) => c.topics || []).join(" ")
  );

  const combined = `${item.document_id.toLowerCase()} ${title} ${topicsText} ${message} ${mediaText} ${claimsText} ${comment}`;
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const effectiveTokens = tokens.length > 0 ? tokens : [q];

  // All tokens must match somewhere
  for (const token of effectiveTokens) {
    if (!combined.includes(token)) {
      return 0;
    }
  }

  let score = 10;
  if (title.includes(q)) score += 60;
  if (topicsText.includes(q)) score += 45;
  if (message.includes(q)) score += 35;
  if (claimsText.includes(q)) score += 25;
  if (mediaText.includes(q)) score += 20;
  if (comment.includes(q)) score += 15;

  for (const token of effectiveTokens) {
    if (title.includes(token)) score += 12;
    if (topicsText.includes(token)) score += 9;
    if (message.includes(token)) score += 6;
    if (claimsText.includes(token)) score += 4;
  }
  return score;
}

function filterAnalyses(
  items: MockAnalysis[],
  params: URLSearchParams,
  latestProcessedAt: string
): MockAnalysis[] {
  const search = (params.get("search") || "").trim();
  const includeWhatsapp = parseBoolParam(params, "message_type_whatsapp", true);
  const includeDirect = parseBoolParam(params, "message_type_direct", true);
  const modText = parseBoolParam(params, "modality_text", true);
  const modAudio = parseBoolParam(params, "modality_audio", true);
  const modVideo = parseBoolParam(params, "modality_video", true);
  const modImage = parseBoolParam(params, "modality_image", true);

  const minTruth = parseIntParam(params, "min_truth_score", 0);
  const maxTruth = parseIntParam(params, "max_truth_score", 100);
  const minFake = parseIntParam(params, "min_fake_score", 0);
  const maxFake = parseIntParam(params, "max_fake_score", 100);
  const minUnv = parseIntParam(params, "min_unverified_score", 0);
  const maxUnv = parseIntParam(params, "max_unverified_score", 100);
  const minOoc = parseIntParam(params, "min_out_of_context_score", 0);
  const maxOoc = parseIntParam(params, "max_out_of_context_score", 100);

  const { startMs, endMs } = resolveDateBounds(params, latestProcessedAt);

  const scored: Array<{ item: MockAnalysis; score: number }> = [];

  for (const item of items) {
    // Message type filter
    if (item.source_type === "FromWhatsappGroup" && !includeWhatsapp) continue;
    if (item.source_type === "FromDirectMessage" && !includeDirect) continue;
    if (!includeWhatsapp && !includeDirect) continue;

    // Modality filter (OR logic, matching bigquery_service.py)
    const hasText = Boolean(item.user_message_text && item.user_message_text.length > 0);
    const hasAudio = Boolean(item.media_info?.has_audio);
    const hasVideo = Boolean(item.media_info?.has_video);
    const hasImage = Boolean(item.media_info?.has_image);

    const modalityMatch =
      (modText && hasText) ||
      (modAudio && hasAudio) ||
      (modVideo && hasVideo) ||
      (modImage && hasImage);
    if (!modalityMatch) continue;

    // Date range filter
    if (startMs !== null || endMs !== null) {
      const itemMs = Date.parse(item.processed_at || "");
      if (Number.isNaN(itemMs)) continue;
      if (startMs !== null && itemMs < startMs) continue;
      if (endMs !== null && itemMs > endMs) continue;
    }

    // Percentage score filters
    const m = item.analysis_metrics;
    const truthScore = m?.truth_score ?? 0;
    const fakeScore = m?.fake_score ?? 0;
    const unvScore = m?.unverified_score ?? 0;
    const oocScore = m?.out_of_context_score ?? 0;

    if (minTruth > 0 && truthScore < minTruth) continue;
    if (maxTruth < 100 && truthScore > maxTruth) continue;
    if (minFake > 0 && fakeScore < minFake) continue;
    if (maxFake < 100 && fakeScore > maxFake) continue;
    if (minUnv > 0 && unvScore < minUnv) continue;
    if (maxUnv < 100 && unvScore > maxUnv) continue;
    if (minOoc > 0 && oocScore < minOoc) continue;
    if (maxOoc < 100 && oocScore > maxOoc) continue;

    if (search) {
      const s = scoreSearchMatch(item, search);
      if (s <= 0) continue;
      scored.push({ item, score: s });
    } else {
      scored.push({ item, score: 0 });
    }
  }

  if (search) {
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.item.processed_at || "").localeCompare(a.item.processed_at || "");
    });
  }

  return scored.map((x) => x.item);
}

function normalizeClaimVerdict(verdict?: string): "FALSO" | "VERDADEIRO" | "FORA_DE_CONTEXTO" | "UNVERIFIED" {
  const v = (verdict || "").toUpperCase().trim();
  if (v === "FAKE" || v === "FALSO" || v === "FALSE") return "FALSO";
  if (v === "TRUE" || v === "VERDADEIRO" || v === "VERDADE") return "VERDADEIRO";
  if (
    v === "FORA_DE_CONTEXTO" ||
    v === "FORA DE CONTEXTO" ||
    v === "OUT_OF_CONTEXT" ||
    v === "OUT OF CONTEXT"
  ) {
    return "FORA_DE_CONTEXTO";
  }
  return "UNVERIFIED";
}

function computeDashboardFromItems(items: MockAnalysis[]) {
  let totalClaims = 0;
  let countFake = 0;
  let countTrue = 0;
  let countUnv = 0;
  let countOoc = 0;
  let countText = 0;
  let countAudio = 0;
  let countVideo = 0;
  let countImage = 0;
  const sourceCounts = new Map<string, number>();

  for (const item of items) {
    if (item.user_message_text && item.user_message_text.length > 0) countText++;
    if (item.media_info?.has_audio) countAudio++;
    if (item.media_info?.has_video) countVideo++;
    if (item.media_info?.has_image) countImage++;

    for (const c of item.claims || []) {
      totalClaims++;
      const vn = normalizeClaimVerdict(c.verdict);
      if (vn === "FALSO") countFake++;
      else if (vn === "VERDADEIRO") countTrue++;
      else if (vn === "FORA_DE_CONTEXTO") countOoc++;
      else countUnv++;

      for (const s of c.sources || []) {
        const url = (s.url || "").trim();
        if (url) {
          sourceCounts.set(url, (sourceCounts.get(url) || 0) + 1);
        }
      }
    }
  }

  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([source, count]) => ({ source, count }));

  return {
    total_messages: items.length,
    total_claims: totalClaims,
    total_out_of_context_claims: countOoc,
    results_distribution: [
      { name: "Falso", value: countFake },
      { name: "Verdadeiro", value: countTrue },
      { name: "Fontes insuficientes para verificar", value: countUnv },
    ],
    modalities_distribution: [
      { name: "Texto", value: countText },
      { name: "Áudio", value: countAudio },
      { name: "Vídeo", value: countVideo },
      { name: "Imagem", value: countImage },
    ],
    top_sources: topSources,
  };
}

function computeSourcesFromItems(items: MockAnalysis[]): Array<{ source: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const c of item.claims || []) {
      for (const s of c.sources || []) {
        const url = (s.url || "").trim();
        if (url) {
          counts.set(url, (counts.get(url) || 0) + 1);
        }
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));
}

function normalizeObs(obs: MockObservation | string | undefined): MockObservation {
  if (obs && typeof obs === "object") {
    return {
      text: obs.text || "Sem observações",
      has_custom_observation: Boolean(obs.has_custom_observation),
    };
  }
  if (typeof obs === "string" && obs.trim()) {
    return { text: obs, has_custom_observation: true };
  }
  return { text: "Sem observações", has_custom_observation: false };
}

function stripPrivateUserFields(user: MockUser): MockUser {
  const { email: _email, ...rest } = user;
  return rest;
}

function computeSimilarAnalyses(original: MockAnalysis, all: MockAnalysis[], limit: number) {
  const topicWeights = new Map<string, number>();
  for (const claim of original.claims || []) {
    for (const topic of claim.topics || []) {
      if (!topic) continue;
      const level = topic.split(" > ").length;
      const prev = topicWeights.get(topic) || 0;
      if (level > prev) topicWeights.set(topic, level);
    }
  }

  if (topicWeights.size === 0) return [];

  const matches: Array<{
    document_id: string;
    analysis_title?: string;
    overall_verdict: string;
    processed_at: string;
    analysis_metrics?: MockAnalysis["analysis_metrics"];
    total_score: number;
    max_level_match: number;
  }> = [];

  for (const candidate of all) {
    if (candidate.document_id === original.document_id) continue;
    let totalScore = 0;
    let maxLevel = 0;
    for (const claim of candidate.claims || []) {
      let claimMatch = 0;
      for (const topic of claim.topics || []) {
        const w = topicWeights.get(topic) || 0;
        if (w > claimMatch) claimMatch = w;
      }
      if (claimMatch > 0) {
        totalScore += claimMatch;
        if (claimMatch > maxLevel) maxLevel = claimMatch;
      }
    }
    if (totalScore > 0) {
      matches.push({
        document_id: candidate.document_id,
        analysis_title: candidate.analysis_title,
        overall_verdict: candidate.overall_verdict,
        processed_at: candidate.processed_at,
        analysis_metrics: candidate.analysis_metrics,
        total_score: totalScore,
        max_level_match: maxLevel,
      });
    }
  }

  matches.sort((a, b) => {
    if (b.max_level_match !== a.max_level_match) return b.max_level_match - a.max_level_match;
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return (b.processed_at || "").localeCompare(a.processed_at || "");
  });

  return matches.slice(0, limit);
}

async function parseJsonBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body) return {};
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function getHeader(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return found ? found[1] : null;
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name.toLowerCase()) return v;
  }
  return null;
}

export async function handleMockApiRequest(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const params = url.searchParams;
  const authHeader = getHeader(init?.headers, "Authorization");

  await simulateNetworkDelay();

  // =========================================================================
  // ANALISES ENDPOINTS
  // =========================================================================

  if (pathname === "/analises/stats" && method === "GET") {
    const statsFile = await loadStatsFile();
    return jsonResponse({ success: true, data: statsFile.stats });
  }

  if (pathname === "/analises/dashboard" && method === "GET") {
    const statsFile = await loadStatsFile();
    if (isUnfilteredParams(params)) {
      return jsonResponse({ success: true, data: statsFile.dashboard });
    }
    const all = await getMergedAllAnalyses();
    const filtered = filterAnalyses(all, params, statsFile.latest_processed_at);
    return jsonResponse({ success: true, data: computeDashboardFromItems(filtered) });
  }

  if (pathname === "/analises/sources/citations" && method === "GET") {
    const targetUrl = (params.get("url") || "").trim();
    if (!targetUrl) {
      return jsonResponse({ success: true, data: { citations: [], total: 0 } });
    }
    const all = await getMergedAllAnalyses();
    const citations: Array<{
      analysis: MockAnalysis & { fileId: string };
      claimId: string;
      claimText: string;
      result: string;
    }> = [];

    for (const analysis of all) {
      for (const claim of analysis.claims || []) {
        const matched = (claim.sources || []).some((s) => (s.url || "").trim() === targetUrl);
        if (matched) {
          citations.push({
            analysis: { ...analysis, fileId: analysis.document_id },
            claimId: claim.claim_id,
            claimText: claim.text,
            result: claim.verdict,
          });
        }
      }
    }

    return jsonResponse({
      success: true,
      data: {
        citations: citations.slice(0, 50),
        total: citations.length,
      },
    });
  }

  if (pathname === "/analises/sources" && method === "GET") {
    const limit = parseIntParam(params, "limit", 10);
    const offset = parseIntParam(params, "offset", 0);
    const statsFile = await loadStatsFile();

    if (isUnfilteredParams(params)) {
      const topFile = await loadTopSourcesFile();
      const items = topFile.items.slice(offset, offset + limit);
      return jsonResponse({
        success: true,
        data: {
          items,
          total: topFile.items.length,
          limit,
          offset,
        },
      });
    }

    const all = await getMergedAllAnalyses();
    const filtered = filterAnalyses(all, params, statsFile.latest_processed_at);
    const allSources = computeSourcesFromItems(filtered);
    return jsonResponse({
      success: true,
      data: {
        items: allSources.slice(offset, offset + limit),
        total: allSources.length,
        limit,
        offset,
      },
    });
  }

  // CSV Exports
  if (pathname === "/analises/export/dashboard" && method === "GET") {
    const statsFile = await loadStatsFile();
    const data = isUnfilteredParams(params)
      ? statsFile.dashboard
      : computeDashboardFromItems(
          filterAnalyses(await getMergedAllAnalyses(), params, statsFile.latest_processed_at)
        );
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    return csvResponse(buildDashboardCsv(data), `dashboard_${stamp}.csv`);
  }

  if (pathname === "/analises/export/messages" && method === "GET") {
    const statsFile = await loadStatsFile();
    const maxRecords = parseIntParam(params, "max_records", 10000);
    const all = await getMergedAllAnalyses();
    const filtered = filterAnalyses(all, params, statsFile.latest_processed_at).slice(0, maxRecords);
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    return csvResponse(buildMessagesCsv(filtered), `mensagens_${stamp}.csv`);
  }

  if (pathname === "/analises/export/sources" && method === "GET") {
    const statsFile = await loadStatsFile();
    const maxRecords = parseIntParam(params, "max_records", 10000);
    let sources: Array<{ source: string; count: number }>;
    if (isUnfilteredParams(params)) {
      const topFile = await loadTopSourcesFile();
      sources = topFile.items.slice(0, maxRecords);
    } else {
      const all = await getMergedAllAnalyses();
      const filtered = filterAnalyses(all, params, statsFile.latest_processed_at);
      sources = computeSourcesFromItems(filtered).slice(0, maxRecords);
    }
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    return csvResponse(buildSourcesCsv(sources), `fontes_${stamp}.csv`);
  }

  // Admin: Search analysis by ID
  if (pathname === "/analises/admin/search" && method === "GET") {
    const docId = (params.get("document_id") || "").trim();
    const found = docId ? await getAnalysisById(docId) : null;
    return jsonResponse({
      success: true,
      data: {
        document_id: docId,
        bigquery_exists: Boolean(found),
        firestore_exists: Boolean(found),
        analise: found,
        bigquery_data: found,
        firestore_data: found,
      },
    });
  }

  // Admin: Inconsistencies
  if (pathname === "/analises/admin/inconsistencies" && method === "GET") {
    const statsFile = await loadStatsFile();
    const overlay = loadOverlay();
    const count = Math.max(0, statsFile.stats.total_verificacoes - overlay.deletedAnalysisIds.length);
    return jsonResponse({
      success: true,
      data: {
        total_inconsistencies: 0,
        inconsistencies: [],
        stats: {
          total_bigquery: count,
          total_firestore: count,
        },
      },
    });
  }

  if (pathname === "/analises/admin/inconsistencies" && method === "DELETE") {
    return jsonResponse({
      success: true,
      data: {
        deleted_from_bigquery: 0,
        deleted_from_firestore: 0,
        total_resolved: 0,
      },
    });
  }

  // Admin: Reviews list
  if (pathname === "/analises/admin/reviews" && method === "GET") {
    const actionFilter = params.get("action");
    const hasObsParam = params.get("has_observation");
    const search = (params.get("search") || "").trim().toLowerCase();
    const limit = parseIntParam(params, "limit", 20);
    const offset = parseIntParam(params, "offset", 0);

    const [all, users] = await Promise.all([getMergedAllAnalyses(), getMergedUsers(true)]);
    const usersMap = new Map(users.map((u) => [u.uid, u]));

    const reviews: Array<{
      document_id: string;
      analysis_title: string;
      overall_verdict: string;
      processed_at: string;
      uid: string;
      action: "like" | "dislike" | "neutral";
      observation: string;
      has_custom_observation: boolean;
      user_name: string;
      user_email: string;
      user_photo: string;
    }> = [];

    for (const a of all) {
      const obsMap = a.observations || {};
      const pushFor = (uids: string[] | undefined, action: "like" | "dislike" | "neutral") => {
        for (const uid of uids || []) {
          const obs = normalizeObs(obsMap[uid]);
          const u = usersMap.get(uid);
          reviews.push({
            document_id: a.document_id,
            analysis_title: a.analysis_title || "Sem título",
            overall_verdict: a.overall_verdict || "",
            processed_at: a.processed_at || "",
            uid,
            action,
            observation: obs.has_custom_observation ? obs.text : "",
            has_custom_observation: obs.has_custom_observation,
            user_name: u?.displayName || "Usuário desconhecido",
            user_email: u?.email || "",
            user_photo: u?.photoURL || "",
          });
        }
      };
      pushFor(a.liked_by, "like");
      pushFor(a.disliked_by, "dislike");
      pushFor(a.neutral_by, "neutral");
    }

    reviews.sort((a, b) => (b.processed_at || "").localeCompare(a.processed_at || ""));

    let filtered = reviews;
    if (actionFilter) {
      filtered = filtered.filter((r) => r.action === actionFilter);
    }
    if (hasObsParam !== null) {
      const wantObs = hasObsParam === "true";
      filtered = filtered.filter((r) =>
        wantObs
          ? r.has_custom_observation && r.observation.trim().length > 0
          : !r.has_custom_observation || r.observation.trim().length === 0
      );
    }
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.user_name.toLowerCase().includes(search) ||
          r.analysis_title.toLowerCase().includes(search) ||
          r.observation.toLowerCase().includes(search)
      );
    }

    return jsonResponse({
      success: true,
      data: {
        reviews: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      },
    });
  }

  // List analyses (GET /analises)
  if (pathname === "/analises" && method === "GET") {
    const limit = parseIntParam(params, "limit", 10);
    const offset = parseIntParam(params, "offset", 0);
    const statsFile = await loadStatsFile();

    if (isUnfilteredParams(params) && offset + limit <= 25) {
      const recent = await getMergedRecentAnalyses();
      const overlay = loadOverlay();
      const total = Math.max(0, statsFile.catalog_count - overlay.deletedAnalysisIds.length);
      const items = recent.slice(offset, offset + limit);
      return jsonResponse({
        success: true,
        data: {
          items,
          conversion_errors: [],
          total,
          limit,
          offset,
          has_more: offset + items.length < total,
        },
      });
    }

    const all = await getMergedAllAnalyses();
    const filtered = filterAnalyses(all, params, statsFile.latest_processed_at);
    const items = filtered.slice(offset, offset + limit);
    return jsonResponse({
      success: true,
      data: {
        items,
        conversion_errors: [],
        total: filtered.length,
        limit,
        offset,
        has_more: offset + items.length < filtered.length,
      },
    });
  }

  // Analysis sub-routes: /analises/:id[/...]
  const analiseSubMatch = pathname.match(
    /^\/analises\/([^/]+)(?:\/(scraped-text|recommendations|interactions|interaction|suggested-sources))?$/
  );
  if (analiseSubMatch) {
    const docId = decodeURIComponent(analiseSubMatch[1]);
    const sub = analiseSubMatch[2];

    if (!sub && method === "GET") {
      const found = await getAnalysisById(docId);
      if (!found) {
        return jsonResponse({ detail: `Análise ${docId} não encontrada` }, 404);
      }
      return jsonResponse({ success: true, data: found, message: "Análise encontrada" });
    }

    if (!sub && method === "DELETE") {
      const found = await getAnalysisById(docId);
      if (!found) {
        return jsonResponse({ detail: `Análise ${docId} não encontrada` }, 404);
      }
      const overlay = loadOverlay();
      if (!overlay.deletedAnalysisIds.includes(docId)) {
        overlay.deletedAnalysisIds.push(docId);
        saveOverlay(overlay);
      }
      return jsonResponse({
        success: true,
        message: "Análise removida com sucesso",
        details: { bigquery_deleted: true, firestore_deleted: true },
      });
    }

    if (sub === "scraped-text" && method === "GET") {
      const found = await getAnalysisById(docId);
      if (!found) {
        return jsonResponse({ detail: `Análise ${docId} não encontrada` }, 404);
      }
      const scrapedMap = await loadScrapedTexts();
      const scrapedLinks =
        scrapedMap[docId] ||
        (found.scraped_links || []).map((l) => ({
          url: l.url,
          title: l.title,
          scraped_text: "Conteúdo extraído não disponível para este link no arquivo histórico.",
        }));
      return jsonResponse({ success: true, data: { scraped_links: scrapedLinks } });
    }

    if (sub === "recommendations" && method === "GET") {
      const limit = parseIntParam(params, "limit", 8);
      const found = await getAnalysisById(docId);
      if (!found) {
        return jsonResponse({ success: true, data: { items: [], total: 0 } });
      }
      const all = await getMergedAllAnalyses();
      const similar = computeSimilarAnalyses(found, all, limit);
      return jsonResponse({
        success: true,
        data: { items: similar, total: similar.length },
      });
    }

    if (sub === "interactions" && method === "GET") {
      const found = await getAnalysisById(docId);
      if (!found) {
        return jsonResponse({ detail: "Análise não encontrada" }, 404);
      }
      const users = await getMergedUsers(true);
      const usersMap = new Map(users.map((u) => [u.uid, u]));
      const obsMap = found.observations || {};
      const suggMap = found.suggested_sources || {};

      const interactions: Array<Record<string, unknown>> = [];
      const addGroup = (uids: string[] | undefined, action: "like" | "dislike" | "neutral") => {
        for (const uid of uids || []) {
          const user = usersMap.get(uid);
          if (!user) continue;
          const obs = normalizeObs(obsMap[uid]);
          const userSources = suggMap[uid];
          interactions.push({
            uid,
            displayName: user.displayName || "Usuário",
            photoURL: user.photoURL || undefined,
            occupation: user.occupation || undefined,
            socials: user.socials || undefined,
            action,
            observation: obs.text,
            has_custom_observation: obs.has_custom_observation,
            suggested_sources: userSources && Object.keys(userSources).length > 0 ? userSources : null,
          });
        }
      };

      addGroup(found.liked_by, "like");
      addGroup(found.disliked_by, "dislike");
      addGroup(found.neutral_by, "neutral");

      return jsonResponse({ interactions });
    }

    if (sub === "interaction" && method === "POST") {
      const authInfo = extractUidFromAuthHeader(authHeader);
      if (!authInfo) {
        return jsonResponse({ detail: "Não autenticado" }, 401);
      }
      const found = await getAnalysisById(docId);
      if (!found) {
        return jsonResponse({ detail: "Análise não encontrada" }, 404);
      }

      const body = await parseJsonBody(init);
      const action = String(body.action || "");
      const rawObs = typeof body.observation === "string" ? body.observation.trim().slice(0, 144) : "";
      const observation: MockObservation = rawObs
        ? { text: rawObs, has_custom_observation: true }
        : { text: "Sem observações", has_custom_observation: false };

      const uid = authInfo.uid;
      const overlay = loadOverlay();
      const liked = new Set(found.liked_by || []);
      const disliked = new Set(found.disliked_by || []);
      const neutral = new Set(found.neutral_by || []);
      const obsRecord: Record<string, MockObservation> = {};
      for (const [k, v] of Object.entries(found.observations || {})) {
        obsRecord[k] = normalizeObs(v);
      }
      const suggRecord = { ...(found.suggested_sources || {}) };

      if (action === "like") {
        liked.add(uid);
        disliked.delete(uid);
        neutral.delete(uid);
        obsRecord[uid] = observation;
      } else if (action === "dislike") {
        disliked.add(uid);
        liked.delete(uid);
        neutral.delete(uid);
        obsRecord[uid] = observation;
      } else if (action === "neutral") {
        neutral.add(uid);
        liked.delete(uid);
        disliked.delete(uid);
        obsRecord[uid] = observation;
      } else if (action === "remove_like") {
        liked.delete(uid);
        delete obsRecord[uid];
        delete suggRecord[uid];
      } else if (action === "remove_dislike") {
        disliked.delete(uid);
        delete obsRecord[uid];
        delete suggRecord[uid];
      } else if (action === "remove_neutral") {
        neutral.delete(uid);
        delete obsRecord[uid];
        delete suggRecord[uid];
      } else {
        return jsonResponse({ detail: "Ação inválida" }, 400);
      }

      overlay.analysisInteractions[docId] = {
        liked_by: Array.from(liked),
        disliked_by: Array.from(disliked),
        neutral_by: Array.from(neutral),
        observations: obsRecord,
        suggested_sources: suggRecord,
      };
      saveOverlay(overlay);
      return jsonResponse({ message: "Interação atualizada com sucesso" });
    }

    if (sub === "suggested-sources" && method === "GET") {
      const found = await getAnalysisById(docId);
      const suggested = found?.suggested_sources || {};
      const users = await getMergedUsers(true);
      const usersMap = new Map(users.map((u) => [u.uid, u]));

      const byClaim: Record<string, Array<Record<string, unknown>>> = {};
      for (const [uid, claimsData] of Object.entries(suggested)) {
        const user = usersMap.get(uid);
        if (!claimsData || typeof claimsData !== "object") continue;
        for (const [claimId, entry] of Object.entries(claimsData)) {
          if (!byClaim[claimId]) byClaim[claimId] = [];
          const items = Array.isArray(entry) ? entry : entry?.items || [];
          const observation = Array.isArray(entry) ? "" : entry?.observation || "";
          byClaim[claimId].push({
            uid,
            displayName: user?.displayName || "Usuário",
            photoURL: user?.photoURL || undefined,
            sources: items,
            observation,
          });
        }
      }
      return jsonResponse({ suggested_sources: byClaim });
    }

    if (sub === "suggested-sources" && method === "POST") {
      const authInfo = extractUidFromAuthHeader(authHeader);
      if (!authInfo) return jsonResponse({ detail: "Não autenticado" }, 401);
      const found = await getAnalysisById(docId);
      if (!found) return jsonResponse({ detail: "Análise não encontrada" }, 404);

      const body = await parseJsonBody(init);
      const claimId = String(body.claim_id || "");
      const sources = Array.isArray(body.sources)
        ? (body.sources as Array<{ url: string; title: string }>)
        : [];
      const obs = typeof body.observation === "string" ? body.observation.trim().slice(0, 300) : "";

      if (!sources.length) return jsonResponse({ detail: "Adicione pelo menos uma fonte." }, 400);
      if (!obs) return jsonResponse({ detail: "A observação é obrigatória." }, 400);

      const uid = authInfo.uid;
      const overlay = loadOverlay();
      const liked = new Set(found.liked_by || []);
      const disliked = new Set(found.disliked_by || []);
      const neutral = new Set(found.neutral_by || []);
      if (!liked.has(uid) && !disliked.has(uid) && !neutral.has(uid)) {
        neutral.add(uid);
      }

      const suggRecord = { ...(found.suggested_sources || {}) };
      suggRecord[uid] = {
        ...(suggRecord[uid] || {}),
        [claimId]: { items: sources, observation: obs },
      };

      const obsRecord: Record<string, MockObservation> = {};
      for (const [k, v] of Object.entries(found.observations || {})) {
        obsRecord[k] = normalizeObs(v);
      }

      overlay.analysisInteractions[docId] = {
        liked_by: Array.from(liked),
        disliked_by: Array.from(disliked),
        neutral_by: Array.from(neutral),
        observations: obsRecord,
        suggested_sources: suggRecord,
      };
      saveOverlay(overlay);
      return jsonResponse({ message: "Fontes sugeridas adicionadas com sucesso" });
    }

    if (sub === "suggested-sources" && method === "DELETE") {
      const authInfo = extractUidFromAuthHeader(authHeader);
      if (!authInfo) return jsonResponse({ detail: "Não autenticado" }, 401);
      const found = await getAnalysisById(docId);
      if (!found) return jsonResponse({ detail: "Análise não encontrada" }, 404);

      const claimId = params.get("claim_id") || "";
      const uid = authInfo.uid;
      const suggRecord = { ...(found.suggested_sources || {}) };
      if (!suggRecord[uid] || !suggRecord[uid][claimId]) {
        return jsonResponse({ detail: "Sugestão de fontes não encontrada." }, 404);
      }

      const userClaims = { ...suggRecord[uid] };
      delete userClaims[claimId];

      const liked = new Set(found.liked_by || []);
      const disliked = new Set(found.disliked_by || []);
      const neutral = new Set(found.neutral_by || []);

      if (Object.keys(userClaims).length === 0) {
        delete suggRecord[uid];
        if (neutral.has(uid) && !liked.has(uid) && !disliked.has(uid)) {
          neutral.delete(uid);
        }
      } else {
        suggRecord[uid] = userClaims;
      }

      const obsRecord: Record<string, MockObservation> = {};
      for (const [k, v] of Object.entries(found.observations || {})) {
        obsRecord[k] = normalizeObs(v);
      }

      const overlay = loadOverlay();
      overlay.analysisInteractions[docId] = {
        liked_by: Array.from(liked),
        disliked_by: Array.from(disliked),
        neutral_by: Array.from(neutral),
        observations: obsRecord,
        suggested_sources: suggRecord,
      };
      saveOverlay(overlay);
      return jsonResponse({ message: "Fontes sugeridas removidas com sucesso" });
    }
  }

  // =========================================================================
  // USERS ENDPOINTS
  // =========================================================================

  if (pathname === "/users/top-reviewers" && method === "GET") {
    const users = await getMergedUsers(false);
    const ranked = users
      .filter((u) => (u.review_count || 0) > 0)
      .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
      .slice(0, 5)
      .map((u) => ({
        user: stripPrivateUserFields(u),
        count: u.review_count || 0,
      }));
    return jsonResponse({
      success: true,
      data: {
        reviewers: ranked,
        period: "all_time",
      },
    });
  }

  if (pathname === "/users/community" && method === "GET") {
    const limit = parseIntParam(params, "limit", 50);
    const offset = parseIntParam(params, "offset", 0);
    const search = normalizeText((params.get("search") || "").trim());

    let users = await getMergedUsers(false);
    if (search) {
      users = users.filter(
        (u) =>
          normalizeText(u.displayName || "").includes(search) ||
          normalizeText(u.occupation || "").includes(search)
      );
    }

    const total = users.length;
    const paginated = users.slice(offset, offset + limit).map(stripPrivateUserFields);

    return jsonResponse({
      success: true,
      data: {
        users: paginated,
        total,
        limit,
        offset,
      },
    });
  }

  if (pathname === "/users/profile" && method === "POST") {
    const body = await parseJsonBody(init);
    const uid = String(body.uid || "");
    if (!uid) return jsonResponse({ detail: "UID obrigatório" }, 400);

    const overlay = loadOverlay();
    overlay.userOverrides[uid] = {
      ...(overlay.userOverrides[uid] || {}),
      uid,
      ...(body.displayName !== undefined ? { displayName: String(body.displayName) } : {}),
      ...(body.photoURL !== undefined ? { photoURL: body.photoURL as string | null } : {}),
      ...(body.bio !== undefined ? { bio: body.bio as string | null } : {}),
      ...(body.occupation !== undefined ? { occupation: body.occupation as string | null } : {}),
      ...(body.socials !== undefined ? { socials: body.socials as MockUser["socials"] } : {}),
      ...(body.createdAt !== undefined ? { createdAt: Number(body.createdAt) } : {}),
    };
    saveOverlay(overlay);
    return jsonResponse({ message: "Perfil criado com sucesso" });
  }

  const profileMatch = pathname.match(/^\/users\/profile\/([^/]+)$/);
  if (profileMatch && method === "GET") {
    const uid = decodeURIComponent(profileMatch[1]);
    const user = await getUserById(uid);
    if (!user) {
      return jsonResponse({ detail: "Perfil não encontrado" }, 404);
    }
    const authInfo = extractUidFromAuthHeader(authHeader);
    const isOwner = authInfo?.uid === uid;
    return jsonResponse(isOwner ? user : stripPrivateUserFields(user));
  }

  const userInteractionsMatch = pathname.match(/^\/users\/([^/]+)\/interactions$/);
  if (userInteractionsMatch && method === "GET") {
    const uid = decodeURIComponent(userInteractionsMatch[1]);
    const all = await getMergedAllAnalyses();
    const interactions: Array<Record<string, unknown>> = [];

    for (const a of all) {
      let kind: "like" | "dislike" | "neutral" | null = null;
      if ((a.liked_by || []).includes(uid)) kind = "like";
      else if ((a.disliked_by || []).includes(uid)) kind = "dislike";
      else if ((a.neutral_by || []).includes(uid)) kind = "neutral";

      if (!kind) continue;

      const obs = normalizeObs((a.observations || {})[uid]);
      const userSources = (a.suggested_sources || {})[uid] || {};

      interactions.push({
        document_id: a.document_id,
        analysis_title: a.analysis_title,
        user_message_text: a.user_message_text,
        processed_at: a.processed_at,
        overall_verdict: a.overall_verdict,
        user_interaction: kind,
        user_observation: obs.text,
        has_custom_observation: obs.has_custom_observation,
        user_suggested_sources: userSources,
      });
    }

    interactions.sort((a, b) =>
      String(b.processed_at || "").localeCompare(String(a.processed_at || ""))
    );
    return jsonResponse({ interactions });
  }

  // Admin Users CRUD
  if (pathname === "/users" && method === "GET") {
    const limit = parseIntParam(params, "limit", 10);
    const offset = parseIntParam(params, "offset", 0);
    const users = await getMergedUsers(true);
    return jsonResponse({
      users: users.slice(offset, offset + limit),
      total: users.length,
      limit,
      offset,
    });
  }

  if (pathname === "/users" && method === "POST") {
    const body = await parseJsonBody(init);
    const uid = `demo-created-${Date.now().toString(36)}`;
    const newUser: MockUser = {
      uid,
      email: String(body.email || ""),
      displayName: String(body.displayName || "Novo Revisor"),
      photoURL: (body.photoURL as string | null) || null,
      createdAt: Date.now(),
      role: body.role === "admin" ? "admin" : "user",
      review_count: 0,
    };
    const overlay = loadOverlay();
    overlay.createdUsers.push(newUser);
    saveOverlay(overlay);
    return jsonResponse({ message: "User created successfully", uid });
  }

  const userRoleMatch = pathname.match(/^\/users\/([^/]+)\/role$/);
  if (userRoleMatch && method === "POST") {
    const uid = decodeURIComponent(userRoleMatch[1]);
    const body = await parseJsonBody(init);
    const role = body.role === "admin" ? "admin" : "user";
    const overlay = loadOverlay();
    overlay.userOverrides[uid] = { ...(overlay.userOverrides[uid] || {}), role };
    saveOverlay(overlay);
    return jsonResponse({ message: `User ${uid} role updated to ${role}` });
  }

  const userProfilePutMatch = pathname.match(/^\/users\/([^/]+)\/profile$/);
  if (userProfilePutMatch && method === "PUT") {
    const uid = decodeURIComponent(userProfilePutMatch[1]);
    const body = await parseJsonBody(init);
    const overlay = loadOverlay();
    overlay.userOverrides[uid] = {
      ...(overlay.userOverrides[uid] || {}),
      ...(body.bio !== undefined ? { bio: body.bio as string } : {}),
      ...(body.occupation !== undefined ? { occupation: body.occupation as string } : {}),
      ...(body.socials !== undefined ? { socials: body.socials as MockUser["socials"] } : {}),
    };
    saveOverlay(overlay);
    return jsonResponse({ message: `Perfil do usuário ${uid} atualizado com sucesso` });
  }

  const userPassMatch = pathname.match(/^\/users\/([^/]+)\/password$/);
  if (userPassMatch && method === "POST") {
    const uid = decodeURIComponent(userPassMatch[1]);
    return jsonResponse({ message: `Senha do usuário ${uid} atualizada com sucesso (demo)` });
  }

  const userDeleteMatch = pathname.match(/^\/users\/([^/]+)$/);
  if (userDeleteMatch && method === "DELETE") {
    const uid = decodeURIComponent(userDeleteMatch[1]);
    const overlay = loadOverlay();
    if (!overlay.deletedUserIds.includes(uid)) {
      overlay.deletedUserIds.push(uid);
      saveOverlay(overlay);
    }
    return jsonResponse({ message: "User deleted successfully" });
  }

  // =========================================================================
  // DONATIONS ENDPOINTS
  // =========================================================================

  if (pathname === "/donations/stats" && method === "GET") {
    const donations = await getMergedDonations();
    return jsonResponse({ success: true, data: donations.stats });
  }

  if (pathname === "/donations/logs" && method === "GET") {
    const start = params.get("start");
    const end = params.get("end");
    const limit = parseIntParam(params, "limit", 30);
    const offset = parseIntParam(params, "offset", 0);

    const donations = await getMergedDonations();
    let items = donations.items;
    if (start) items = items.filter((d) => d.date >= start);
    if (end) items = items.filter((d) => d.date <= end);

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);
    return jsonResponse({
      success: true,
      data: {
        items: paginated,
        total,
        limit,
        offset,
        has_more: offset + paginated.length < total,
      },
    });
  }

  if (pathname === "/donations/logs" && method === "POST") {
    const body = await parseJsonBody(init);
    const date = String(body.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonResponse({ detail: "Data deve estar no formato YYYY-MM-DD" }, 400);
    }
    const now = new Date().toISOString();
    const log = {
      date,
      amount_brl: Number(body.amount_brl || 0),
      markdown: String(body.markdown || ""),
      created_at: now,
      updated_at: now,
    };
    const overlay = loadOverlay();
    overlay.donationOverrides[date] = log;
    overlay.deletedDonationDates = overlay.deletedDonationDates.filter((d) => d !== date);
    saveOverlay(overlay);
    return jsonResponse({ success: true, data: log });
  }

  const donationDateMatch = pathname.match(/^\/donations\/logs\/(\d{4}-\d{2}-\d{2})$/);
  if (donationDateMatch) {
    const logDate = donationDateMatch[1];

    if (method === "GET") {
      const donations = await getMergedDonations();
      const item = donations.items.find((d) => d.date === logDate);
      if (!item) return jsonResponse({ detail: "Log não encontrado" }, 404);
      return jsonResponse({ success: true, data: item });
    }

    if (method === "PUT") {
      const body = await parseJsonBody(init);
      const donations = await getMergedDonations();
      const existing = donations.items.find((d) => d.date === logDate);
      if (!existing) return jsonResponse({ detail: "Log não encontrado" }, 404);
      const updated = {
        ...existing,
        amount_brl: Number(body.amount_brl ?? existing.amount_brl),
        markdown: String(body.markdown ?? existing.markdown),
        updated_at: new Date().toISOString(),
      };
      const overlay = loadOverlay();
      overlay.donationOverrides[logDate] = updated;
      saveOverlay(overlay);
      return jsonResponse({ success: true, data: updated });
    }

    if (method === "DELETE") {
      const overlay = loadOverlay();
      delete overlay.donationOverrides[logDate];
      if (!overlay.deletedDonationDates.includes(logDate)) {
        overlay.deletedDonationDates.push(logDate);
      }
      saveOverlay(overlay);
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ detail: `Endpoint mock não encontrado: ${method} ${pathname}` }, 404);
}

let isInstalled = false;

function isApiUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const apiBase = new URL(MOCK_API_BASE, window.location.origin);

    // Match exact configured API origin/base
    if (parsed.origin === apiBase.origin && parsed.pathname.startsWith(apiBase.pathname === "/" ? "/" : apiBase.pathname)) {
      const relPath =
        apiBase.pathname !== "/" && parsed.pathname.startsWith(apiBase.pathname)
          ? parsed.pathname.slice(apiBase.pathname.length) || "/"
          : parsed.pathname;
      if (
        relPath === "/analises" ||
        relPath.startsWith("/analises/") ||
        relPath === "/users" ||
        relPath.startsWith("/users/") ||
        relPath === "/donations" ||
        relPath.startsWith("/donations/")
      ) {
        const normalized = new URL(parsed.toString());
        normalized.pathname = relPath;
        return normalized;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function installMockFetch(): void {
  if (isInstalled) return;
  isInstalled = true;

  const originalFetch = window.fetch.bind(window);
  setNativeFetch(originalFetch);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const matchedUrl = isApiUrl(rawUrl);
    if (matchedUrl) {
      const effectiveInit: RequestInit =
        init ||
        (input instanceof Request
          ? {
              method: input.method,
              headers: input.headers,
              body: input.body,
            }
          : undefined) ||
        {};
      return handleMockApiRequest(matchedUrl, effectiveInit);
    }

    return originalFetch(input, init);
  };
}
