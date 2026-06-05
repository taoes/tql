// ============================================================
// Anthropic Messages API — wire-format types
// ============================================================

// ── Tool types (Anthropic format) ─────────────────────────────

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// ── Request types ─────────────────────────────────────────────

/** Request body for the Anthropic Messages API */
export interface AnthropicMessageRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicRequestMessage[];
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: AnthropicToolDefinition[];
}

export interface AnthropicRequestMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock;

// ── Content block types ──────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

// ── Delta types ──────────────────────────────────────────────

export interface TextDelta {
  type: "text_delta";
  text: string;
}

export interface ThinkingDelta {
  type: "thinking_delta";
  thinking: string;
}

export interface InputJsonDelta {
  type: "input_json_delta";
  partial_json: string;
}

// ── Non-streaming response ──────────────────────────────────

export interface AnthropicMessage {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

// ── SSE event types ─────────────────────────────────────────

export interface MessageStartEvent {
  type: "message_start";
  message: AnthropicMessage;
}

export interface MessageDeltaEvent {
  type: "message_delta";
  delta: { stop_reason: string; stop_sequence: string | null };
  usage: { output_tokens: number };
}

export interface MessageStopEvent {
  type: "message_stop";
}

export interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: TextBlock | ThinkingBlock | ToolUseBlock;
}

export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: TextDelta | ThinkingDelta | InputJsonDelta;
}

export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

export interface PingEvent {
  type: "ping";
}

export interface AnthropicErrorEvent {
  type: "error";
  error: { type: string; message: string };
}

export type AnthropicStreamEvent =
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | PingEvent
  | AnthropicErrorEvent;
