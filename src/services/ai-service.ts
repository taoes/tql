import type { AIService, AIServiceConfig, ChatMessage, StreamCallbacks } from "./types";
import { streamChatCompletion as openaiCompatibleStream } from "./deepseek/api";
import { streamMessages as anthropicStream } from "./anthropic/api";

// ============================================================
// AI Service Factory
//
// This is the ONLY module that UI components import.
// It creates the correct provider adapter based on config,
// so components never know which provider is being used.
//
// Usage:
//   const ai = createAIService(settings);
//   const ctrl = ai.streamChat(messages, callbacks);
// ============================================================

/**
 * Create an AI service instance for the given configuration.
 *
 * Currently supported providers:
 * - OpenAI / DeepSeek / local (OpenAI-compatible SSE)
 * - Anthropic (placeholder — not yet implemented)
 */
export function createAIService(config: AIServiceConfig): AIService {
  const provider = config.provider as string;

  switch (provider) {
    case "openai":
    case "deepseek":
    case "local":
      // All use the OpenAI-compatible SSE protocol
      return {
        streamChat(messages: ChatMessage[], callbacks: StreamCallbacks, signal?: AbortSignal,): AbortController {
          return openaiCompatibleStream(config, messages, callbacks, signal);
        },
      };

    case "anthropic":
      return {
        streamChat(messages: ChatMessage[], callbacks: StreamCallbacks, signal?: AbortSignal): AbortController {
          return anthropicStream(config, messages, callbacks, signal);
        },
      };

    default:
      return {
        streamChat(
          _messages: ChatMessage[],
          callbacks: StreamCallbacks,
          _signal?: AbortSignal,
        ): AbortController {
          const controller = new AbortController();
          setTimeout(() => {
            callbacks.onError(
              new Error(`Unknown AI provider: ${provider}`),
            );
          }, 0);
          return controller;
        },
      };
  }
}
