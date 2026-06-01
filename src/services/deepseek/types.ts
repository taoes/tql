// ============================================================
// DeepSeek API Type Definitions (OpenAI-compatible wire format)
// Ref: https://api-docs.deepseek.com/api/create-chat-completion
// ============================================================

import type { ChatMessage } from "../types";

/** Parameters for a chat completion request body */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

/** A single choice in a non-streaming completion response */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/** Token usage info */
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Non-streaming chat completion response */
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatUsage;
}

/** Delta content in a streaming chunk */
export interface StreamDelta {
  role?: string;
  content?: string;
  reasoning_content?: string;
}

/** A single choice in a streaming chunk */
export interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/** A single streaming SSE chunk */
export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: StreamChoice[];
}
