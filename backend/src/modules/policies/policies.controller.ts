import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { PoliciesService } from "./policies.service";
import { UpdatePolicyDto } from "./dto/update-policy.dto";

@Controller({ path: "policies", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get("children/:childId/current")
  @Roles("parent")
  getCurrentForParent(
    @CurrentUser() user: JwtPayload,
    @Param("childId", ParseUUIDPipe) childId: string,
  ) {
    return this.policiesService.getCurrentForParent(user, childId);
  }

  @Patch("children/:childId")
  @Roles("parent")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("childId", ParseUUIDPipe) childId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policiesService.update(user, childId, dto);
  }

  /** Device Agent — دریافت آخرین Policy برای اعمال محلی (بعد از دریافت SYNC_POLICY یا به‌صورت دوره‌ای). */
  @Get("current")
  @Roles("device")
  getCurrentForDevice(@CurrentUser() user: JwtPayload) {
    return this.policiesService.getCurrentForDevice(user);
  }
}
