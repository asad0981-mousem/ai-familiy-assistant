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

  ApiClient({
    required this.baseUrl,
    required String? Function() tokenProvider,
    http.Client? client,
  })  : _client = client ?? http.Client(),
        _tokenProvider = tokenProvider;

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

  Future<dynamic> post(String path, {Map<String, dynamic>? body, bool withAuth = true}) async {
    final response = await _client.post(
      _uri(path),
      headers: _headers(withAuth: withAuth),
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(response);
  }

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
