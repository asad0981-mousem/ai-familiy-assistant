import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { TutorService } from "./tutor.service";
import { SendMessageDto } from "./dto/send-message.dto";

@Controller({ path: "ai-tutor", version: "1" })
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post("messages")
  async sendMessage(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    return this.tutorService.sendMessage(user, dto);
  }
}
