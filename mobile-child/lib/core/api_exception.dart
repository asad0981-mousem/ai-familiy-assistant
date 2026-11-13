/// خطای ساختاریافته برای پاسخ‌های ناموفق API — دقیقاً مطابق mobile-parent/lib/core/api_exception.dart
/// تا هر دو اپ رفتار یکسانی روی 401/404/409/400 داشته باشند.
class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException(this.statusCode, this.message);

  bool get isUnauthorized => statusCode == 401;
  bool get isNotFound => statusCode == 404;
  bool get isBadRequest => statusCode == 400;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
