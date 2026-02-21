export type MessageType = "FromWhatsappGroup" | "FromDirectMessage";

export type VerificationResult = "VERDADEIRO" | "FALSO" | "ENGANOSO" | "FORA_DE_CONTEXTO" | "CHECK" | "UNVERIFIED";

export interface ScrapedLink {
  url: string;
  title: string;
  scraped_text?: string;
}

export interface MediaInfo {
  has_audio: boolean;
  audio_uri: string | null;
  audio_text: string | null;
  has_image: boolean;
  image_uri: string | null;
  image_text: string | null;
  has_video: boolean;
  video_uri: string | null;
  video_text: string | null;
}

export interface Source {
  url: string;
  title: string | null;
  publisher: string | null;
  citation_text: string | null;
}

export interface SuggestedSource {
  url: string;
  title: string;
}

export interface ClaimSuggestedSources {
  uid: string;
  displayName: string;
  photoURL?: string;
  sources: SuggestedSource[];
  observation?: string;
}

export interface Claim {
  claim_id: string;
  text: string;
  verdict: VerificationResult;
  reasoning: string;
  topics: string[];
  sources: Source[];
}

export interface AnalysisMetrics {
  total_claims: number;
  true_count: number;
  fake_count: number;
  out_of_context_count: number;
  unverified_count: number;
  truth_score: number;
  fake_score: number;
  out_of_context_score: number;
  unverified_score: number;
}

export interface Analysis {
  document_id: string;
  processed_at: string;
  source_type: MessageType;
  analysis_title?: string;
  user_message_text: string;
  full_combined_text?: string;
  scraped_links: ScrapedLink[];
  liked_by?: string[];
  disliked_by?: string[];
  neutral_by?: string[];
  overall_verdict: string;
  final_comment: string;
  media_info: MediaInfo;
  analysis_metrics?: AnalysisMetrics;
  claims: Claim[];
}
