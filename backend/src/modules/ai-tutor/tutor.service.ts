import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Conversation } from "./entities/conversation.entity";
import { Message, MessageRole } from "./entities/message.entity";
import { AiMemory, MemoryLevel } from "./entities/ai-memory.entity";
import { AiProviderFactory } from "./providers/ai-provider.factory";
import { SafetyService } from "./safety/safety.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { JwtPayload } from "../auth/strategies/jwt.strategy";

@Injectable()
export class TutorService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(AiMemory)
    private readonly memories: Repository<AiMemory>,
    private readonly aiProvider: AiProviderFactory,
    private readonly safety: SafetyService,
  ) {}

  /**
   * ارسال پیام کودک به Tutor و دریافت پاسخ.
   * اعمال Tenant Isolation: هر Query روی conversations/memories با familyId کاربر درخواست‌دهنده
   * فیلتر می‌شود (نه family_id دریافتی از body) — جلوگیری از IDOR مطابق TC-SEC-010/011 فاز ۱۰.
   */
  async sendMessage(requester: JwtPayload, dto: SendMessageDto) {
    const safetyCheck = this.safety.checkUserInput(dto.content);
    if (!safetyCheck.allowed) {
      throw new BadRequestException(safetyCheck.reason);
    }

    const conversation = await this.getOrCreateConversation(requester, dto.conversationId);

    const userMessage = this.messages.create({
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: dto.content,
    });
    await this.messages.save(userMessage);

    const history = await this.messages.find({
      where: { conversationId: conversation.id },
      order: { createdAt: "ASC" },
      take: 20, // پنجره کوتاه‌مدت؛ حافظه بلندمدت از ai_memories تامین می‌شود، نه تاریخچه کامل خام
    });

    const memoryContext = await this.buildMemoryContext(requester.familyId, requester.sub);

    const completion = await this.aiProvider.completeWithFallback({
      messages: [
        { role: "system", content: memoryContext },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ],
    });

    const outputCheck = this.safety.checkAiOutput(completion.content);
    if (!outputCheck.allowed) {
      throw new BadRequestException("پاسخ تولیدشده قابل نمایش نیست؛ لطفاً دوباره تلاش کنید");
    }

    const assistantMessage = this.messages.create({
      conversationId: conversation.id,
      role: MessageRole.ASSISTANT,
      content: completion.content,
      provider: completion.provider,
      model: completion.model,
    });
    await this.messages.save(assistantMessage);

    return {
      conversationId: conversation.id,
      reply: completion.content,
      provider: completion.provider,
    };
  }

  private async getOrCreateConversation(
    requester: JwtPayload,
    conversationId?: string,
  ): Promise<Conversation> {
    if (conversationId) {
      const existing = await this.conversations.findOne({ where: { id: conversationId } });
      if (!existing) {
        throw new NotFoundException("مکالمه یافت نشد");
      }
      if (existing.familyId !== requester.familyId) {
        // هرگز پیام خطای متفاوت برای "وجود دارد اما مال شما نیست" در مقابل "وجود ندارد" نده (IDOR enumeration)
        throw new NotFoundException("مکالمه یافت نشد");
      }
      return existing;
    }

    const conversation = this.conversations.create({
      familyId: requester.familyId,
      childId: requester.sub,
      startedAt: new Date(),
    });
    return this.conversations.save(conversation);
  }

  private async buildMemoryContext(familyId: string, childId: string): Promise<string> {
    const relevant = await this.memories.find({
      where: [
        { familyId, childId, level: MemoryLevel.SKILL_PROGRESS },
        { familyId, childId, level: MemoryLevel.LEARNER_PROFILE },
        { familyId, childId: undefined, level: MemoryLevel.FAMILY_CONTEXT },
      ],
      take: 30,
    });

    const lines = relevant.map((m) => `${m.key}: ${JSON.stringify(m.value)}`);
    return [
      "You are a friendly, patient English tutor for a child learning English as a second language.",
      "Keep responses short, encouraging, and age-appropriate. Never discuss topics unrelated to learning.",
      lines.length ? `Known context about this learner:\n${lines.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
}
