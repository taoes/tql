// ============================================================
// Shared AI Service Types (provider-agnostic)
//
// These types define the contract between UI components and
// the AI service layer. Components never import provider-
// specific types directly.
// ============================================================

/** Role of a chat message */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A single chat message */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Tool calls made by the assistant (OpenAI format) */
  tool_calls?: ToolCall[];
  /** ID of the tool call this message responds to */
  tool_call_id?: string;
}

// ── Tool / Function Calling ────────────────────────────────────

/** OpenAI-compatible function definition */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** OpenAI-compatible tool definition */
export interface ToolDefinition {
  type: "function";
  function: FunctionDefinition;
}

/** A tool call requested by the AI model */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** Parsed tool call with deserialized arguments */
export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Result of executing a tool */
export interface ToolResult {
  toolCallId: string;
  content: string;
}

// ── Stream Callbacks ───────────────────────────────────────────

/** Callbacks for streaming chat completion */
export interface StreamCallbacks {
  /** Called when a new content chunk arrives */
  onChunk: (content: string) => void;
  /** Called when reasoning/thinking content arrives */
  onReasoning?: (content: string) => void;
  /** Called when tool calls are detected (before onComplete) */
  onToolCalls?: (toolCalls: ParsedToolCall[]) => void;
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
   * @param tools - optional tool definitions for function calling
   * @returns An AbortController that can be used to cancel the stream.
   */
  streamChat(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    tools?: ToolDefinition[],
  ): AbortController;
}
