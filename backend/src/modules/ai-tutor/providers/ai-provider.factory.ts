import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiCompletionRequest, AiCompletionResult } from "./ai-provider.port";
import { OpenAiProvider } from "./openai.provider";
import { AnthropicProvider } from "./anthropic.provider";

/**
 * Fallback Orchestration — طبق فصل ۱۳: اگر Primary Provider خطا دهد (Timeout/Rate Limit/5xx)،
 * به Fallback Provider سوییچ می‌شود. این رفتار باید بدون تغییر کد بالادست (TutorService) اتفاق بیفتد.
 */
@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);
  private readonly primaryName: string;
  private readonly fallbackName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly openAi: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
  ) {
    this.primaryName = this.config.get<string>("ai.primaryProvider") || "openai";
    this.fallbackName = this.config.get<string>("ai.fallbackProvider") || "anthropic";
  }

  private resolve(name: string) {
    return name === "anthropic" ? this.anthropic : this.openAi;
  }

  async completeWithFallback(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const primary = this.resolve(this.primaryName);
    try {
      return await primary.complete(request);
    } catch (err) {
      this.logger.warn(
        `Primary AI provider (${primary.name}) failed, falling back to ${this.fallbackName}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      const fallback = this.resolve(this.fallbackName);
      return fallback.complete(request);
    }
  }
}
