// ============================================================
// Shared AI Service Types (provider-agnostic)
//
// These types define the contract between UI components and
// the AI service layer. Components never import provider-
// specific types directly.
// ============================================================

/** Role of a chat message */
export type ChatRole = "system" | "user" | "assistant";

/** A single chat message */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Callbacks for streaming chat completion */
export interface StreamCallbacks {
  /** Called when a new content chunk arrives */
  onChunk: (content: string) => void;
  /** Called when reasoning/thinking content arrives */
  onReasoning?: (content: string) => void;
  /** Called when the stream completes with the full accumulated content */
  onComplete: (fullContent: string) => void;
  /** Called when an error occurs */
  onError: (error: Error) => void;
}

/** Configuration for the AI service — derived from user settings */
export interface AIServiceConfig {
  provider: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

/**
 * Abstract AI service interface.
 *
 * UI components depend on this interface only — they never
 * import provider-specific modules.
 */
export interface AIService {
  /**
   * Start a streaming chat completion.
   *
   * @returns An AbortController that can be used to cancel the stream.
   */
  streamChat(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): AbortController;
}
