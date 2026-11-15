/// استخراج و اعتبارسنجی «کد ورود» (childId) از محتوای اسکن‌شده یک QR Code — مطابق فرمت تولیدشده
/// توسط qr_flutter در mobile-parent (ChildDetailScreen._showLoginCode): فقط خود UUID، بدون
/// پیشوند/طرحواره خاص (نه حتی JSON). این تابع عمداً خالص و جدا از UI نوشته شده تا بدون نیاز به
/// دوربین واقعی (که در تست واحد بدون دستگاه در دسترس نیست) قابل تست باشد — خود اسکن دوربین
/// (QrScanScreen) هیچ منطقی غیر از فراخوانی همین تابع ندارد.
final _uuidPattern = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

String? extractChildIdFromScan(String? raw) {
  if (raw == null) return null;
  final trimmed = raw.trim();
  if (!_uuidPattern.hasMatch(trimmed)) return null;
  return trimmed;
}
