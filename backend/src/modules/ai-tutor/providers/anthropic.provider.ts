import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiChatMessage,
  AiCompletionRequest,
  AiCompletionResult,
  AiProviderPort,
} from "./ai-provider.port";

/**
 * Adapter برای Anthropic — به‌عنوان Fallback Provider طبق فصل ۱۳.
 * بدون SDK رسمی؛ فراخوانی مستقیم Messages API با fetch.
 */
@Injectable()
export class AnthropicProvider implements AiProviderPort {
  readonly name = "anthropic";
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiKey?: string;
  private readonly model = "claude-sonnet-5";

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("ai.anthropicApiKey");
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY تنظیم نشده است");
    }

    const systemMessage = request.messages.find((m) => m.role === "system");
    const conversation: AiChatMessage[] = request.messages.filter(
      (m) => m.role !== "system",
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system: systemMessage?.content,
        messages: conversation.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: request.maxTokens ?? 500,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Anthropic API error ${response.status}: ${errorBody}`);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content.find((c) => c.type === "text")?.text ?? "",
      provider: this.name,
      model: this.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
          }
        : undefined,
    };
  }
}
