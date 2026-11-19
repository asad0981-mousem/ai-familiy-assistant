import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { DevicesService } from "./devices.service";
import { EnrollDeviceDto } from "./dto/enroll-device.dto";
import { CreateCommandDto } from "./dto/create-command.dto";
import { AckCommandDto } from "./dto/ack-command.dto";
import { UpdateManagementModeDto } from "./dto/update-management-mode.dto";

@Controller({ path: "devices", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post("enroll")
  @Roles("parent")
  enroll(@CurrentUser() user: JwtPayload, @Body() dto: EnrollDeviceDto) {
    return this.devicesService.enroll(user, dto);
  }

  @Get()
  @Roles("parent")
  list(@CurrentUser() user: JwtPayload) {
    return this.devicesService.listForFamily(user);
  }

  @Post(":deviceId/commands")
  @Roles("parent")
  createCommand(
    @CurrentUser() user: JwtPayload,
    @Param("deviceId", ParseUUIDPipe) deviceId: string,
    @Body() dto: CreateCommandDto,
  ) {
    return this.devicesService.createCommand(user, deviceId, dto);
  }

  /**
   * Device Agent با توکن device این مسیر را Poll می‌کند (Outbox Pull Pattern).
   * عمداً بدون :deviceId در مسیر — دستگاه همیشه فقط دستورات خودش را می‌بیند (از token.sub)،
   * نه از هر deviceId دلخواهی که در URL قرار گیرد.
   */
  @Get("commands/pending")
  @Roles("device")
  listPending(@CurrentUser() user: JwtPayload) {
    return this.devicesService.listPendingCommands(user);
  }

  @Post("commands/:commandId/ack")
  @Roles("device")
  ack(
    @CurrentUser() user: JwtPayload,
    @Param("commandId", ParseUUIDPipe) commandId: string,
    @Body() dto: AckCommandDto,
  ) {
    return this.devicesService.ackCommand(user, commandId, dto);
  }

  /**
   * فقط خود Device Agent این مسیر را صدا می‌زند (نه والد) — بعد از این‌که واقعاً وضعیت Device Owner
   * را از DevicePolicyManager.isDeviceOwnerApp خواند. این تنها راه معتبر برای تبدیل managementMode
   * از STANDARD به DEVICE_OWNER بعد از Enrollment است.
   */
  @Patch("management-mode")
  @Roles("device")
  updateManagementMode(@CurrentUser() user: JwtPayload, @Body() dto: UpdateManagementModeDto) {
    return this.devicesService.updateManagementMode(user, dto);
  }
}
