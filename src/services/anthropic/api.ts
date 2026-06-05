import type { AIServiceConfig, StreamCallbacks, ChatMessage, ToolDefinition, ParsedToolCall } from "../types";
import type { AnthropicMessageRequest, AnthropicStreamEvent, AnthropicRequestMessage, AnthropicContentBlock, AnthropicToolDefinition } from "./types";
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
  messages: AnthropicRequestMessage[];
}

function extractSystemPrompt(messages: ChatMessage[]): ExtractedMessages {
  const systemParts: string[] = [];
  const rest: AnthropicRequestMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else if (msg.role === "tool") {
      // Tool result → convert to tool_result block
      rest.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "",
            content: msg.content,
          },
        ],
      });
    } else if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      // Assistant message with tool calls → convert to tool_use blocks
      const blocks: AnthropicContentBlock[] = [];
      if (msg.content) {
        blocks.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.function.arguments); } catch { /* keep empty */ }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      rest.push({ role: "assistant", content: blocks });
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

/** Convert shared ToolDefinition to Anthropic format */
function convertTools(tools: ToolDefinition[]): AnthropicToolDefinition[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/** Build the Anthropic request body */
function buildBody(
  config: AIServiceConfig,
  messages: ChatMessage[],
  stream: boolean,
  tools?: ToolDefinition[],
): AnthropicMessageRequest {
  const { system, messages: anthropicMessages } =
    extractSystemPrompt(messages);

  const body: AnthropicMessageRequest = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    ...(system ? { system } : {}),
    messages: anthropicMessages,
    temperature: config.temperature,
    top_p: config.topP,
    stream,
  };

  if (tools && tools.length > 0) {
    body.tools = convertTools(tools);
  }

  return body;
}

/**
 * Streaming chat completion via the Anthropic Messages API (SSE).
 * Supports tool use.
 */
export function streamMessages(
  config: AIServiceConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  tools?: ToolDefinition[],
): AbortController {
  const controller = new AbortController();
  const mergedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal;

  const url = buildUrl(config.apiUrl);
  const body = buildBody(config, messages, true, tools);

  let fullContent = "";
  // Track tool use blocks by index: { id, name, partial_json }
  const toolUseBlocks = new Map<number, { id: string; name: string; partialJson: string }>();

  fetch(url, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
    signal: mergedSignal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
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

            // content_block_start
            if (event.type === "content_block_start") {
              const block = event.content_block;
              if (block.type === "text" && block.text) {
                fullContent += block.text;
                callbacks.onChunk(block.text);
              } else if (block.type === "thinking" && block.thinking) {
                callbacks.onReasoning?.(block.thinking);
              } else if (block.type === "tool_use") {
                toolUseBlocks.set(event.index, {
                  id: block.id,
                  name: block.name,
                  partialJson: "",
                });
              }
            }

            // content_block_delta
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta.type === "text_delta" && delta.text) {
                fullContent += delta.text;
                callbacks.onChunk(delta.text);
              } else if (delta.type === "thinking_delta" && delta.thinking) {
                callbacks.onReasoning?.(delta.thinking);
              } else if (delta.type === "input_json_delta" && delta.partial_json) {
                const existing = toolUseBlocks.get(event.index);
                if (existing) {
                  existing.partialJson += delta.partial_json;
                }
              }
            }
          } catch (parseErr) {
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

      // Flush remaining buffer
      if (buffer.trim() && buffer.trim().startsWith("data:")) {
        const data = buffer.trim().slice(5).trim();
        try {
          const event: AnthropicStreamEvent = JSON.parse(data);
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (delta.type === "text_delta" && delta.text) {
              fullContent += delta.text;
              callbacks.onChunk(delta.text);
            } else if (delta.type === "input_json_delta" && delta.partial_json) {
              const existing = toolUseBlocks.get(event.index);
              if (existing) {
                existing.partialJson += delta.partial_json;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Build parsed tool calls from tool_use blocks
      if (toolUseBlocks.size > 0) {
        const parsedCalls: ParsedToolCall[] = Array.from(toolUseBlocks.entries())
          .sort(([a], [b]) => a - b)
          .map(([_, tu]) => {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tu.partialJson); } catch { /* keep empty */ }
            return { id: tu.id, name: tu.name, arguments: args };
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
