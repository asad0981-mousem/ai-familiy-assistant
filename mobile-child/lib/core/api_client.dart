import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_exception.dart';

/// کلاینت HTTP برای بک‌اند AI Family Assistant — سمت اپ کودک. فقط دو مسیری که کودک واقعاً به آن
/// نیاز دارد: ورود با PIN (backend/src/modules/auth/auth.controller.ts) و گفتگو با AI Tutor
/// (backend/src/modules/ai-tutor/tutor.controller.ts). http.Client به‌صورت تزریقی گرفته می‌شود
/// تا در تست با http.testing.MockClient جایگزین شود.
class ApiClient {
  final String baseUrl;
  final http.Client _client;
  final String? Function() _tokenProvider;
  final String? Function()? _refreshTokenProvider;
  final void Function(String accessToken, String refreshToken)? _onTokensRefreshed;
  final void Function()? _onRefreshFailed;

  ApiClient({
    required this.baseUrl,
    required String? Function() tokenProvider,
    String? Function()? refreshTokenProvider,
    void Function(String accessToken, String refreshToken)? onTokensRefreshed,
    void Function()? onRefreshFailed,
    http.Client? client,
  })  : _client = client ?? http.Client(),
        _tokenProvider = tokenProvider,
        _refreshTokenProvider = refreshTokenProvider,
        _onTokensRefreshed = onTokensRefreshed,
        _onRefreshFailed = onRefreshFailed;

  Uri _uri(String path) => Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/$path');

  Map<String, String> _headers({bool withAuth = true}) {
    final headers = {'Content-Type': 'application/json; charset=utf-8'};
    if (withAuth) {
      final token = _tokenProvider();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  dynamic _decode(http.Response response) {
    final body = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    String message = 'خطای ناشناخته از سرور';
    if (body is Map && body['message'] != null) {
      final m = body['message'];
      message = m is List ? m.join('، ') : m.toString();
    }
    throw ApiException(response.statusCode, message);
  }

  /// اگر ۴۰۱ برگشت و این یک درخواست احرازشده بود و Refresh Token در دسترس بود، یک‌بار تلاش
  /// می‌کند accessToken را با POST /auth/refresh تمدید کند و درخواست اصلی را با توکن جدید دوباره
  /// بفرستد. بدون این مکانیزم، چون accessToken کوتاه‌مدت است (پیش‌فرض ۱۵ دقیقه)، کودک هر ۱۵
  /// دقیقه به‌اجبار از چت خارج می‌شد — آیتم باز مستندشده قبلی در mobile-child/README.md.
  Future<dynamic> _withAuthRetry(
    Future<http.Response> Function() send, {
    required bool allowRefresh,
  }) async {
    final response = await send();
    try {
      return _decode(response);
    } on ApiException catch (e) {
      if (e.statusCode == 401 && allowRefresh && await _tryRefresh()) {
        final retryResponse = await send();
        return _decode(retryResponse);
      }
      rethrow;
    }
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = _refreshTokenProvider?.call();
    if (refreshToken == null) return false;
    try {
      final response = await _client.post(
        _uri('auth/refresh'),
        headers: _headers(withAuth: false),
        body: jsonEncode({'refreshToken': refreshToken}),
      );
      final result = _decode(response) as Map<String, dynamic>;
      _onTokensRefreshed?.call(result['accessToken'] as String, result['refreshToken'] as String);
      return true;
    } on ApiException {
      _onRefreshFailed?.call();
      return false;
    }
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body, bool withAuth = true}) =>
      _withAuthRetry(
        () => _client.post(
          _uri(path),
          headers: _headers(withAuth: withAuth),
          body: body != null ? jsonEncode(body) : null,
        ),
        allowRefresh: withAuth,
      );

  /// ورود کودک با کد ورود (childId) + PIN — بدون نیاز به ایمیل/رمز عبور.
  /// مطابق backend/src/modules/auth/dto/child-login.dto.ts و AuthService.childLogin.
  Future<Map<String, dynamic>> childLogin({required String childId, required String pin}) async {
    final result = await post(
      'auth/child-login',
      withAuth: false,
      body: {'childId': childId, 'pin': pin},
    );
    return result as Map<String, dynamic>;
  }

  /// ارسال پیام به AI Tutor. در اولین پیام conversationId نداریم؛ پاسخ، conversationId واقعی را
  /// برمی‌گرداند که برای پیام‌های بعدی همان گفتگو دوباره فرستاده می‌شود (تا تاریخچه/Memory حفظ شود).
  Future<Map<String, dynamic>> sendTutorMessage({
    required String content,
    String? conversationId,
  }) async {
    final result = await post(
      'ai-tutor/messages',
      body: {
        'content': content,
        if (conversationId != null) 'conversationId': conversationId,
      },
    );
    return result as Map<String, dynamic>;
  }
}
