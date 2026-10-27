import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiCompletionRequest,
  AiCompletionResult,
  AiProviderPort,
} from "./ai-provider.port";

/**
 * Adapter برای OpenAI — بدون وابستگی به SDK رسمی (از fetch داخلی Node استفاده می‌شود)
 * تا نصب بسته جانبی برای این Adapter خاص الزامی نباشد. در صورت نیاز به ویژگی پیشرفته‌تر
 * (Streaming، Function calling)، می‌توان به SDK رسمی مهاجرت کرد بدون تغییر AiProviderPort.
 */
@Injectable()
export class OpenAiProvider implements AiProviderPort {
  readonly name = "openai";
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly apiKey?: string;
  private readonly model = "gpt-4o-mini";

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("ai.openaiApiKey");
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY تنظیم نشده است");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 500,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`OpenAI API error ${response.status}: ${errorBody}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? "",
      provider: this.name,
      model: this.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }
}
