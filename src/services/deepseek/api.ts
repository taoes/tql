import type { AIServiceConfig, StreamCallbacks, ChatMessage, ToolDefinition, ParsedToolCall, ToolCall } from "../types";
import type { ChatCompletionRequest, ChatCompletionChunk, ToolCallDelta } from "./types";
import { combineSignals } from "../utils";

// ============================================================
// DeepSeek / OpenAI-compatible streaming implementation
//
// This is the low-level provider adapter. It is NOT imported
// directly by UI components — they use the abstract AIService
// from ../ai-service.ts instead.
// ============================================================

/** Build the full API endpoint URL */
function buildUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

/** Build request headers */
function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/** Build the request body */
function buildBody(
  config: AIServiceConfig,
  messages: ChatMessage[],
  stream: boolean,
  tools?: ToolDefinition[],
): ChatCompletionRequest {
  const body: ChatCompletionRequest = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    stream,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  return body;
}

/**
 * Streaming chat completion via SSE for OpenAI-compatible APIs.
 *
 * Works with: DeepSeek, OpenAI, and any OpenAI-compatible endpoint.
 * Supports function calling (tools).
 */
export function streamChatCompletion(
  config: AIServiceConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  tools?: ToolDefinition[],
): AbortController {
  const controller = new AbortController();

  // Merge external signal with our own controller
  const mergedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal;

  const url = buildUrl(config.apiUrl);
  const body = buildBody(config, messages, true, tools);

  let fullContent = "";
  // Track tool call deltas by index
  const toolCallDeltas = new Map<number, ToolCallDelta>();

  fetch(url, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
    signal: mergedSignal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`AI API error (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable (streaming not supported)");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk: ChatCompletionChunk = JSON.parse(data);
            for (const choice of chunk.choices) {
              if (choice.delta.reasoning_content) {
                callbacks.onReasoning?.(choice.delta.reasoning_content);
              }
              if (choice.delta.content) {
                fullContent += choice.delta.content;
                callbacks.onChunk(choice.delta.content);
              }
              // Accumulate tool call deltas
              if (choice.delta.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const existing = toolCallDeltas.get(tc.index);
                  if (existing) {
                    if (tc.id) existing.id = tc.id;
                    if (tc.function?.name) existing.function = { ...existing.function, name: (existing.function?.name ?? "") + tc.function.name };
                    if (tc.function?.arguments) existing.function = { ...existing.function, arguments: (existing.function?.arguments ?? "") + tc.function.arguments };
                  } else {
                    toolCallDeltas.set(tc.index, { ...tc });
                  }
                }
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim() && buffer.trim().startsWith("data:")) {
        const data = buffer.trim().slice(5).trim();
        if (data !== "[DONE]") {
          try {
            const chunk: ChatCompletionChunk = JSON.parse(data);
            for (const choice of chunk.choices) {
              if (choice.delta.content) {
                fullContent += choice.delta.content;
                callbacks.onChunk(choice.delta.content);
              }
              if (choice.delta.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const existing = toolCallDeltas.get(tc.index);
                  if (existing) {
                    if (tc.function?.arguments) existing.function = { ...existing.function, arguments: (existing.function?.arguments ?? "") + tc.function.arguments };
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // Build tool calls from accumulated deltas
      if (toolCallDeltas.size > 0) {
        const rawToolCalls: ToolCall[] = Array.from(toolCallDeltas.values())
          .sort((a, b) => a.index - b.index)
          .map((tc) => ({
            id: tc.id ?? `call_${tc.index}`,
            type: "function" as const,
            function: {
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "{}",
            },
          }));

        // Parse arguments and notify
        const parsedCalls: ParsedToolCall[] = rawToolCalls.map((tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            // keep empty args
          }
          return { id: tc.id, name: tc.function.name, arguments: args };
        });

        callbacks.onToolCalls?.(parsedCalls);
      }

      callbacks.onComplete(fullContent);
    })
    .catch((error: Error) => {
      if (error.name === "AbortError") return;
      callbacks.onError(error);
    });

  return controller;
}
