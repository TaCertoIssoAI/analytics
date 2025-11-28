export type MessageType = "FromWhatsappGroup" | "FromDirectMessage";

export type VerificationResult = "Fake" | "True" | "Misleading" | "Unknown";

export interface Claim {
  text: string;
  links: string[];
}

export interface ClaimResponse {
  Result: VerificationResult;
  reasoningText: string;
  reasoningSources: string[];
}

export interface Analysis {
  DocumentId: string;
  PureText: string;
  FinalTranscribedText: string;
  HadAudio: boolean;
  AudioText: string;
  HadImage: boolean;
  ImageText: string;
  HadVideo: boolean;
  VideoText: string;
  Links: string[];
  MessageType: MessageType;
  Claims: Record<string, Claim>;
  Date: string;
  Topics: string[];
  ResponseByClaim: Record<string, ClaimResponse>;
  CommentAboutCompleteContext: string;
  FinalResponseText: string;
}
