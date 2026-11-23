import type { Analysis, ScrapedLink } from "@/types/analysis";
import { DEMO_ACCOUNTS, getStoredMockSession } from "./mockAuth";

export interface MockObservation {
  text: string;
  has_custom_observation: boolean;
}

export interface MockSuggestedSourceEntry {
  items: Array<{ url: string; title: string }>;
  observation: string;
}

export interface MockAnalysis extends Analysis {
  observations?: Record<string, MockObservation | string>;
  suggested_sources?: Record<string, Record<string, MockSuggestedSourceEntry>>;
}

export interface MockUser {
  uid: string;
  email?: string | null;
  displayName: string;
  createdAt: number;
  photoURL?: string | null;
  bio?: string | null;
  occupation?: string | null;
  socials?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  } | null;
  role?: "admin" | "user";
  review_count?: number;
}

export interface MockDonationLog {
  date: string;
  amount_brl: number;
  markdown: string;
  created_at: string;
  updated_at: string;
}

export interface MockStatsFile {
  latest_processed_at: string;
  earliest_processed_at: string;
  catalog_count: number;
  total_unique_sources: number;
  stats: {
    total_verificacoes: number;
    total_afirmacoes: number;
    percentual_falso: number;
  };
  dashboard: {
    total_messages: number;
    total_claims: number;
    total_out_of_context_claims: number;
    results_distribution: Array<{ name: string; value: number }>;
    modalities_distribution: Array<{ name: string; value: number }>;
    top_sources: Array<{ source: string; count: number }>;
  };
}

export interface MockTopSourcesFile {
  total: number;
  items: Array<{ source: string; count: number }>;
}

export interface MockDonationsFile {
  stats: {
    total_brl: number;
    days_count: number;
    last_update: string | null;
  };
  items: MockDonationLog[];
}

interface PersistedOverlay {
  userOverrides: Record<string, Partial<MockUser>>;
  createdUsers: MockUser[];
  deletedUserIds: string[];
  analysisInteractions: Record<
    string,
    {
      liked_by?: string[];
      disliked_by?: string[];
      neutral_by?: string[];
      observations?: Record<string, MockObservation>;
      suggested_sources?: Record<string, Record<string, MockSuggestedSourceEntry>>;
    }
  >;
  deletedAnalysisIds: string[];
  donationOverrides: Record<string, MockDonationLog>;
  deletedDonationDates: string[];
}

const STATE_STORAGE_KEY = "tcia_mock_state_v1";

// Capture the native fetch reference before installMockFetch wraps window.fetch
let nativeFetchRef: typeof window.fetch = window.fetch.bind(window);

export function setNativeFetch(fn: typeof window.fetch): void {
  nativeFetchRef = fn;
}

export function getNativeFetch(): typeof window.fetch {
  return nativeFetchRef;
}

function emptyOverlay(): PersistedOverlay {
  return {
    userOverrides: {},
    createdUsers: [],
    deletedUserIds: [],
    analysisInteractions: {},
    deletedAnalysisIds: [],
    donationOverrides: {},
    deletedDonationDates: [],
  };
}

export function loadOverlay(): PersistedOverlay {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<PersistedOverlay>;
    return {
      userOverrides: parsed.userOverrides || {},
      createdUsers: parsed.createdUsers || [],
      deletedUserIds: parsed.deletedUserIds || [],
      analysisInteractions: parsed.analysisInteractions || {},
      deletedAnalysisIds: parsed.deletedAnalysisIds || [],
      donationOverrides: parsed.donationOverrides || {},
      deletedDonationDates: parsed.deletedDonationDates || [],
    };
  } catch {
    return emptyOverlay();
  }
}

export function saveOverlay(overlay: PersistedOverlay): void {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await nativeFetchRef(path);
  if (!res.ok) {
    throw new Error(`Failed to load mock dataset ${path} (${res.status})`);
  }
  return (await res.json()) as T;
}

let statsPromise: Promise<MockStatsFile> | null = null;
let topSourcesPromise: Promise<MockTopSourcesFile> | null = null;
let usersPromise: Promise<MockUser[]> | null = null;
let donationsPromise: Promise<MockDonationsFile> | null = null;
let recentAnalysesPromise: Promise<MockAnalysis[]> | null = null;
let allAnalysesPromise: Promise<MockAnalysis[]> | null = null;
let scrapedTextsPromise: Promise<Record<string, ScrapedLink[]>> | null = null;
let prefetchScheduled = false;

function scheduleAllAnalysesPrefetch(): void {
  if (prefetchScheduled || allAnalysesPromise) return;
  prefetchScheduled = true;
  const trigger = () => {
    loadAllAnalysesBase().catch(() => {
      // Ignore background prefetch errors; explicit loads will retry
    });
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
      trigger,
      { timeout: 2500 }
    );
  } else {
    setTimeout(trigger, 1500);
  }
}

export function loadStatsFile(): Promise<MockStatsFile> {
  if (!statsPromise) {
    statsPromise = fetchJson<MockStatsFile>("/mock-data/stats.json");
  }
  return statsPromise;
}

export function loadTopSourcesFile(): Promise<MockTopSourcesFile> {
  if (!topSourcesPromise) {
    topSourcesPromise = fetchJson<MockTopSourcesFile>("/mock-data/top-sources.json");
  }
  return topSourcesPromise;
}

export function loadBaseUsers(): Promise<MockUser[]> {
  if (!usersPromise) {
    usersPromise = fetchJson<MockUser[]>("/mock-data/users.json");
  }
  return usersPromise;
}

export function loadBaseDonations(): Promise<MockDonationsFile> {
  if (!donationsPromise) {
    donationsPromise = fetchJson<MockDonationsFile>("/mock-data/donations.json");
  }
  return donationsPromise;
}

export function loadRecentAnalysesBase(): Promise<MockAnalysis[]> {
  if (allAnalysesPromise) {
    return allAnalysesPromise.then((all) => all.slice(0, 25));
  }
  if (!recentAnalysesPromise) {
    recentAnalysesPromise = fetchJson<MockAnalysis[]>("/mock-data/recent-analyses.json").then(
      (items) => {
        scheduleAllAnalysesPrefetch();
        return items;
      }
    );
  }
  return recentAnalysesPromise;
}

export function loadAllAnalysesBase(): Promise<MockAnalysis[]> {
  if (!allAnalysesPromise) {
    allAnalysesPromise = fetchJson<MockAnalysis[]>("/mock-data/analyses.json");
  }
  return allAnalysesPromise;
}

export function loadScrapedTexts(): Promise<Record<string, ScrapedLink[]>> {
  if (!scrapedTextsPromise) {
    scrapedTextsPromise = fetchJson<Record<string, ScrapedLink[]>>("/mock-data/scraped-texts.json");
  }
  return scrapedTextsPromise;
}

function applyAnalysisOverlay(doc: MockAnalysis, overlay: PersistedOverlay): MockAnalysis {
  const ov = overlay.analysisInteractions[doc.document_id];
  if (!ov) return doc;
  return {
    ...doc,
    liked_by: ov.liked_by ?? doc.liked_by ?? [],
    disliked_by: ov.disliked_by ?? doc.disliked_by ?? [],
    neutral_by: ov.neutral_by ?? doc.neutral_by ?? [],
    observations: ov.observations ?? doc.observations ?? {},
    suggested_sources: ov.suggested_sources ?? doc.suggested_sources ?? {},
  };
}

export async function getMergedRecentAnalyses(): Promise<MockAnalysis[]> {
  const [base, overlay] = await Promise.all([loadRecentAnalysesBase(), Promise.resolve(loadOverlay())]);
  const deleted = new Set(overlay.deletedAnalysisIds);
  return base.filter((d) => !deleted.has(d.document_id)).map((d) => applyAnalysisOverlay(d, overlay));
}

export async function getMergedAllAnalyses(): Promise<MockAnalysis[]> {
  const [base, overlay] = await Promise.all([loadAllAnalysesBase(), Promise.resolve(loadOverlay())]);
  const deleted = new Set(overlay.deletedAnalysisIds);
  return base.filter((d) => !deleted.has(d.document_id)).map((d) => applyAnalysisOverlay(d, overlay));
}

export async function getAnalysisById(documentId: string): Promise<MockAnalysis | null> {
  // Fast check in recent first if full catalog not yet loaded
  if (!allAnalysesPromise) {
    const recent = await getMergedRecentAnalyses();
    const foundRecent = recent.find((a) => a.document_id === documentId);
    if (foundRecent) return foundRecent;
  }
  const all = await getMergedAllAnalyses();
  return all.find((a) => a.document_id === documentId) || null;
}

function getDemoProfileDefaults(uid: string): MockUser | null {
  if (uid === DEMO_ACCOUNTS.reviewer.uid) {
    return {
      uid: DEMO_ACCOUNTS.reviewer.uid,
      email: DEMO_ACCOUNTS.reviewer.email,
      displayName: DEMO_ACCOUNTS.reviewer.displayName,
      createdAt: DEMO_ACCOUNTS.reviewer.createdAt,
      photoURL: null,
      occupation: "Checador de Fatos (Conta Demo)",
      bio: "Perfil demonstrativo para testar avaliações, observações e sugestão de fontes sem afetar a base real.",
      socials: {},
      role: "user",
      review_count: 0,
    };
  }
  if (uid === DEMO_ACCOUNTS.admin.uid) {
    return {
      uid: DEMO_ACCOUNTS.admin.uid,
      email: DEMO_ACCOUNTS.admin.email,
      displayName: DEMO_ACCOUNTS.admin.displayName,
      createdAt: DEMO_ACCOUNTS.admin.createdAt,
      photoURL: null,
      occupation: "Administrador da Plataforma (Conta Demo)",
      bio: "Perfil administrativo demonstrativo para testar o painel /admin, gestão de revisores e logs de transparência.",
      socials: {},
      role: "admin",
      review_count: 0,
    };
  }
  const session = getStoredMockSession();
  if (session && session.uid === uid) {
    return {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      createdAt: session.createdAt,
      photoURL: session.photoURL,
      occupation: session.role === "admin" ? "Administrador (Demo)" : "Revisor (Demo)",
      bio: "Sessão demonstrativa local.",
      socials: {},
      role: session.role,
      review_count: 0,
    };
  }
  return null;
}

export async function getMergedUsers(includeActiveDemo = false): Promise<MockUser[]> {
  const base = await loadBaseUsers();
  const overlay = loadOverlay();
  const deleted = new Set(overlay.deletedUserIds);

  const map = new Map<string, MockUser>();
  for (const u of base) {
    if (!deleted.has(u.uid)) {
      map.set(u.uid, { ...u });
    }
  }
  for (const u of overlay.createdUsers) {
    if (!deleted.has(u.uid)) {
      map.set(u.uid, { ...u });
    }
  }

  // Ensure active logged-in demo session is resolvable when requested
  if (includeActiveDemo) {
    const session = getStoredMockSession();
    if (session && !map.has(session.uid) && !deleted.has(session.uid)) {
      const def = getDemoProfileDefaults(session.uid);
      if (def) map.set(def.uid, def);
    }
  }

  // Apply overrides
  for (const [uid, ov] of Object.entries(overlay.userOverrides)) {
    const existing = map.get(uid) || getDemoProfileDefaults(uid);
    if (existing && !deleted.has(uid)) {
      map.set(uid, { ...existing, ...ov });
    }
  }

  // Adjust review_count if local interactions changed
  if (Object.keys(overlay.analysisInteractions).length > 0) {
    const allAnalyses = await getMergedAllAnalyses();
    const countMap = new Map<string, number>();
    for (const a of allAnalyses) {
      const uids = new Set<string>([
        ...(a.liked_by || []),
        ...(a.disliked_by || []),
        ...(a.neutral_by || []),
      ]);
      uids.forEach((uid) => countMap.set(uid, (countMap.get(uid) || 0) + 1));
    }
    map.forEach((user, uid) => {
      const dynamicCount = countMap.get(uid);
      if (dynamicCount !== undefined) {
        user.review_count = dynamicCount;
      }
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    (a.displayName || "").localeCompare(b.displayName || "", "pt-BR")
  );
}

export async function getUserById(uid: string): Promise<MockUser | null> {
  const users = await getMergedUsers(true);
  const found = users.find((u) => u.uid === uid);
  if (found) return found;
  const demo = getDemoProfileDefaults(uid);
  if (demo) {
    const overlay = loadOverlay();
    return { ...demo, ...(overlay.userOverrides[uid] || {}) };
  }
  return null;
}

export async function getMergedDonations(): Promise<MockDonationsFile> {
  const base = await loadBaseDonations();
  const overlay = loadOverlay();
  const deleted = new Set(overlay.deletedDonationDates);

  const map = new Map<string, MockDonationLog>();
  for (const item of base.items) {
    if (!deleted.has(item.date)) {
      map.set(item.date, { ...item });
    }
  }
  for (const [date, item] of Object.entries(overlay.donationOverrides)) {
    if (!deleted.has(date)) {
      map.set(date, { ...item });
    }
  }

  const items = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  const totalBrl = Math.round(items.reduce((acc, i) => acc + Number(i.amount_brl || 0), 0) * 100) / 100;
  let lastUpdate: string | null = null;
  for (const i of items) {
    const upd = i.updated_at || i.created_at;
    if (upd && (!lastUpdate || upd > lastUpdate)) {
      lastUpdate = upd;
    }
  }

  return {
    stats: {
      total_brl: totalBrl,
      days_count: items.length,
      last_update: lastUpdate,
    },
    items,
  };
}
