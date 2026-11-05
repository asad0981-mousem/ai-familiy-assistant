import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

class SleepScheduleDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "start باید به‌فرمت HH:mm باشد" })
  start!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "end باید به‌فرمت HH:mm باشد" })
  end!: string;
}

/**
 * ورودی به‌روزرسانی Policy — Partial عمدی (فقط فیلدهایی که والد می‌فرستد تغییر می‌کنند،
 * بقیه از Policy فعلی حفظ می‌شوند — در PoliciesService ادغام می‌شود).
 */
export class UpdatePolicyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  screenTimeMinutesPerDay?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedApps?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SleepScheduleDto)
  sleepSchedule?: SleepScheduleDto;

  /**
   * expectedVersion اختیاری — اگر فرستاده شود و با نسخه فعلی سرور مطابقت نداشته باشد،
   * درخواست با 409 رد می‌شود (Optimistic Locking صریح سمت کلاینت).
   */
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
