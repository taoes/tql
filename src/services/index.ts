// ============================================================
// Services — public API
//
// UI components should ONLY import from this barrel or from
// ./types.ts and ./ai-service.ts directly.
// NEVER import from ./deepseek/ — that's a provider internal.
// ============================================================

export { createAIService } from "./ai-service";
export type {
  ChatRole,
  ChatMessage,
  StreamCallbacks,
  AIServiceConfig,
  AIService,
} from "./types";
