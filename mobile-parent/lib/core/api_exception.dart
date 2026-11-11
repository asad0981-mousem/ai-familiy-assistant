/// خطای ساختاریافته برای پاسخ‌های ناموفق API — statusCode به UI اجازه می‌دهد رفتار متفاوتی
/// برای 401 (نیاز به ورود دوباره)، 404 (IDOR/یافت‌نشد)، 409 (تعارض نسخه Policy) و غیره نشان دهد.
class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException(this.statusCode, this.message);

  bool get isUnauthorized => statusCode == 401;
  bool get isConflict => statusCode == 409;
  bool get isNotFound => statusCode == 404;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
