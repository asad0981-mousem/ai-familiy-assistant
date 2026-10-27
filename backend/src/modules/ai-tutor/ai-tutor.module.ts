import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { AiMemory } from "./entities/ai-memory.entity";
import { TutorService } from "./tutor.service";
import { TutorController } from "./tutor.controller";
import { AiProviderFactory } from "./providers/ai-provider.factory";
import { OpenAiProvider } from "./providers/openai.provider";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { SafetyService } from "./safety/safety.service";

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, AiMemory])],
  providers: [
    TutorService,
    AiProviderFactory,
    OpenAiProvider,
    AnthropicProvider,
    SafetyService,
  ],
  controllers: [TutorController],
  exports: [TutorService],
})
export class AiTutorModule {}
