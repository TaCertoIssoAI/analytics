export type MessageType = "FromWhatsappGroup" | "FromDirectMessage";

export type VerificationResult = "Fake" | "True" | "Misleading" | "Unknown";

export interface ScrapedLink {
  url: string;
  title: string;
  scraped_text: string;
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

export interface Claim {
  claim_id: string;
  text: string;
  verdict: VerificationResult;
  reasoning: string;
  topics: string[];
  sources: Source[];
}

export interface Analysis {
  document_id: string;
  processed_at: string;
  source_type: MessageType;
  analysis_title?: string;
  user_message_text: string;
  full_combined_text: string;
  scraped_links: ScrapedLink[];
  overall_verdict: string;
  final_comment: string;
  media_info: MediaInfo;
  claims: Claim[];
}
