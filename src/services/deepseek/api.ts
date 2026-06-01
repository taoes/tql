import type { AIServiceConfig, StreamCallbacks, ChatMessage } from "../types";
import type { ChatCompletionRequest, ChatCompletionChunk } from "./types";

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
): ChatCompletionRequest {
  return {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    stream,
  };
}

/**
 * Streaming chat completion via SSE for OpenAI-compatible APIs.
 *
 * Works with: DeepSeek, OpenAI, and any OpenAI-compatible endpoint.
 */
export function streamChatCompletion(
  config: AIServiceConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): AbortController {
  const controller = new AbortController();

  // Merge external signal with our own controller
  const mergedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal;

  const url = buildUrl(config.apiUrl);
  const body = buildBody(config, messages, true);

  let fullContent = "";

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
            }
          } catch {
            // ignore
          }
        }
      }

      callbacks.onComplete(fullContent);
    })
    .catch((error: Error) => {
      if (error.name === "AbortError") return;
      callbacks.onError(error);
    });

  return controller;
}

/** Combine two AbortSignals so either one aborts the operation */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => {
    controller.abort();
    a.removeEventListener("abort", onAbort);
    b.removeEventListener("abort", onAbort);
  };

  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);

  if (a.aborted || b.aborted) {
    controller.abort();
  }

  return controller.signal;
}
