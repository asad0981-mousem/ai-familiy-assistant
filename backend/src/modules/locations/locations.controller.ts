import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { LocationsService } from "./locations.service";
import { ReportLocationDto } from "./dto/report-location.dto";
import { SetConsentDto } from "./dto/set-consent.dto";

@Controller({ path: "locations", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post("consent/grant")
  @Roles("parent")
  grantConsent(@CurrentUser() user: JwtPayload, @Body() dto: SetConsentDto) {
    return this.locationsService.grantConsent(user, dto);
  }

  @Post("consent/revoke")
  @Roles("parent")
  async revokeConsent(@CurrentUser() user: JwtPayload, @Body() dto: SetConsentDto) {
    await this.locationsService.revokeConsent(user, dto);
    return { status: "ok" };
  }

  /** Device Agent موقعیت مکانی را گزارش می‌کند — رد می‌شود اگر Consent فعال نباشد. */
  @Post("report")
  @Roles("device")
  async report(@CurrentUser() user: JwtPayload, @Body() dto: ReportLocationDto) {
    await this.locationsService.reportLocation(user, dto);
    return { status: "ok" };
  }

  @Get("children/:childId/latest")
  @Roles("parent")
  getLatest(@CurrentUser() user: JwtPayload, @Param("childId", ParseUUIDPipe) childId: string) {
    return this.locationsService.getLatest(user, childId);
  }
}
