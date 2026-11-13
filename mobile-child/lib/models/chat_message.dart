/// پیام محلی چت (UI) — پاسخ بک‌اند حافظه کامل مکالمه را برنمی‌گرداند (فقط conversationId/reply
/// برای همان یک پیام)، پس تاریخچه نمایش‌داده‌شده فقط در حافظه همین اجرای اپ نگه‌داری می‌شود؛
/// مطابق backend/src/modules/ai-tutor/tutor.service.ts (پنجره کوتاه‌مدت ۲۰تایی سمت سرور، بدون
/// GET تاریخچه).
class ChatMessage {
  final String content;
  final bool isFromChild; // true = پیام کودک، false = پاسخ Tutor
  final String? provider; // فقط برای پیام‌های Tutor ("openai"/"anthropic")

  ChatMessage({required this.content, required this.isFromChild, this.provider});
}
