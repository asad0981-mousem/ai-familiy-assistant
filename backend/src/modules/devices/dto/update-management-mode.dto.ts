import { IsEnum } from "class-validator";
import { DeviceManagementMode } from "../entities/device.entity";

/**
 * بدنه PATCH /devices/management-mode — فقط خود Device Agent (نه والد) این مسیر را صدا می‌زند،
 * بعد از این‌که واقعاً وضعیت Device Owner را از android.app.admin.DevicePolicyManager.isDeviceOwnerApp
 * خواند؛ یعنی این مقدار همیشه بازتاب‌دهنده واقعیت دستگاه است، نه ادعای والد یا سرور.
 */
export class UpdateManagementModeDto {
  @IsEnum(DeviceManagementMode)
  managementMode!: DeviceManagementMode;
}
