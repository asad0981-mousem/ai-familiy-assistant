import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * بدنه PATCH /devices/fcm-token — فقط خود Device Agent (نه والد) این مسیر را صدا می‌زند، بعد از
 * این‌که توکن واقعی را از FirebaseMessaging.getInstance().token یا onNewToken() خواند.
 */
export class UpdateFcmTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fcmToken!: string;
}
