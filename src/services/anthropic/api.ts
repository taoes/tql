import type { AIServiceConfig, StreamCallbacks, ChatMessage } from "../types";
import type { AnthropicMessageRequest, AnthropicStreamEvent } from "./types";
import { combineSignals } from "../utils";

// ============================================================
// Anthropic Messages API — streaming implementation
// ============================================================

/** Build the full API endpoint URL */
function buildUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, "");
  return `${base}/messages`;
}

/** Build Anthropic-specific request headers */
function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
}

/**
 * Extract system prompt from messages array.
 * Anthropic uses a top-level `system` field instead of system-role messages.
 */
interface ExtractedMessages {
  system: string | undefined;
  messages: { role: "user" | "assistant"; content: string }[];
}

function extractSystemPrompt(messages: ChatMessage[]): ExtractedMessages {
  const systemParts: string[] = [];
  const rest: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      rest.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: rest,
  };
}

/** Build the Anthropic request body */
function buildBody(
  config: AIServiceConfig,
  messages: ChatMessage[],
  stream: boolean,
): AnthropicMessageRequest {
  const { system, messages: anthropicMessages } =
    extractSystemPrompt(messages);

  return {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    ...(system ? { system } : {}),
    messages: anthropicMessages,
    temperature: config.temperature,
    top_p: config.topP,
    stream,
  };
}

/**
 * Streaming chat completion via the Anthropic Messages API (SSE).
 */
export function streamMessages(
  config: AIServiceConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): AbortController {
  const controller = new AbortController();
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
        // Try to extract Anthropic's structured error message
        try {
          const errorBody = JSON.parse(errorText);
          if (errorBody?.error?.message) {
            throw new Error(`Anthropic API error: ${errorBody.error.message}`);
          }
        } catch (parseErr) {
          if (
            parseErr instanceof Error &&
            parseErr.message.startsWith("Anthropic API error")
          ) {
            throw parseErr;
          }
        }
        throw new Error(
          `Anthropic API error (${response.status}): ${errorText}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(
          "Response body is not readable (streaming not supported)",
        );
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
            const event: AnthropicStreamEvent = JSON.parse(data);

            // API-level error sent as an SSE event
            if (event.type === "error") {
              throw new Error(
                `Anthropic API error: ${event.error.message}`,
              );
            }

            // content_block_start — first chunk of a content block
            if (event.type === "content_block_start") {
              const block = event.content_block;
              if (block.type === "text" && block.text) {
                fullContent += block.text;
                callbacks.onChunk(block.text);
              } else if (block.type === "thinking" && block.thinking) {
                callbacks.onReasoning?.(block.thinking);
              }
            }

            // content_block_delta — streaming delta
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta.type === "text_delta" && delta.text) {
                fullContent += delta.text;
                callbacks.onChunk(delta.text);
              } else if (delta.type === "thinking_delta" && delta.thinking) {
                callbacks.onReasoning?.(delta.thinking);
              }
            }
          } catch (parseErr) {
            // If we already threw a structured error above, re-throw
            if (
              parseErr instanceof Error &&
              parseErr.message.startsWith("Anthropic API error")
            ) {
              throw parseErr;
            }
            // Otherwise skip malformed JSON lines
          }
        }
      }

      // Flush remaining buffer (same as DeepSeek adapter)
      if (buffer.trim() && buffer.trim().startsWith("data:")) {
        const data = buffer.trim().slice(5).trim();
        try {
          const event: AnthropicStreamEvent = JSON.parse(data);
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (delta.type === "text_delta" && delta.text) {
              fullContent += delta.text;
              callbacks.onChunk(delta.text);
            }
          }
        } catch {
          // ignore
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
