import { Matches } from "class-validator";

/**
 * PIN ورود کودک — ۴ تا ۶ رقم عددی (مشابه الگوی رایج قفل صفحه کودکان در اپ‌های کنترل والدین).
 * طول کوتاه عمداً انتخاب شده (کودک باید بتواند به‌خاطر بسپارد و تایپ کند)؛ محافظت در برابر
 * Brute-force با Rate Limiting سطح اپلیکیشن (ThrottlerGuard) انجام می‌شود، نه طول PIN.
 */
export class SetChildPinDto {
  @Matches(/^\d{4,6}$/, { message: "PIN باید ۴ تا ۶ رقم عددی باشد" })
  pin!: string;
}
