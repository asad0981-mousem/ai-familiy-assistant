import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { UsersService } from "./users.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { SetChildPinDto } from "./dto/set-child-pin.dto";

@Controller({ path: "family-members", version: "1" })
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    const members = await this.usersService.listFamilyMembers(user);
    return members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      role: m.role,
      ageBand: m.ageBand,
    }));
  }

  @Post("children")
  async createChild(@CurrentUser() user: JwtPayload, @Body() dto: CreateChildDto) {
    const child = await this.usersService.createChild(user, dto);
    return { id: child.id, displayName: child.displayName, ageBand: child.ageBand };
  }

  @Patch("children/:childId/pin")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setChildPin(
    @CurrentUser() user: JwtPayload,
    @Param("childId") childId: string,
    @Body() dto: SetChildPinDto,
  ) {
    await this.usersService.setChildPin(user, childId, dto);
  }
}
