/**
 * AI Provider Abstraction Layer (AIProviderPort) — طبق فصل ۱۳ (AI Architecture) Blueprint نهایی.
 * هر Adapter واقعی (OpenAI, Anthropic, ...) این اینترفیس را پیاده‌سازی می‌کند؛
 * هیچ بخشی از منطق محصول نباید مستقیماً SDK یک Provider خاص را import کند (Vendor-Neutral).
 */
export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  messages: AiChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiCompletionResult {
  content: string;
  provider: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AiProviderPort {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

export const AI_PROVIDER_PORT = Symbol("AI_PROVIDER_PORT");
