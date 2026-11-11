import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_exception.dart';

/// کلاینت HTTP برای بک‌اند AI Family Assistant — دقیقاً مطابق قرارداد مسیرهای فصل ۴/۵/۲۰ Blueprint
/// (backend/src/modules/*/*.controller.ts). همه مسیرها زیر پیشوند نسخه‌دار /api/v1/ هستند
/// (app.enableVersioning(VersioningType.URI) سمت سرور).
///
/// http.Client به‌صورت تزریقی گرفته می‌شود تا در تست با http.testing.MockClient جایگزین شود —
/// بدون این تزریق، تست واقعی این کلاس بدون شبکه واقعی ممکن نبود.
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

  Future<dynamic> get(String path) async {
    final response = await _client.get(_uri(path), headers: _headers());
    return _decode(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body, bool withAuth = true}) async {
    final response = await _client.post(
      _uri(path),
      headers: _headers(withAuth: withAuth),
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(response);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final response = await _client.patch(
      _uri(path),
      headers: _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(response);
  }

  // --- Auth (بدون نیاز به توکن) ---

  Future<Map<String, dynamic>> register({
    required String familyName,
    required String displayName,
    required String email,
    required String password,
  }) async {
    final result = await post(
      'auth/register',
      withAuth: false,
      body: {
        'familyName': familyName,
        'displayName': displayName,
        'email': email,
        'password': password,
      },
    );
    return result as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> login({required String email, required String password}) async {
    final result = await post(
      'auth/login',
      withAuth: false,
      body: {'email': email, 'password': password},
    );
    return result as Map<String, dynamic>;
  }

  // --- Family Members ---

  Future<List<dynamic>> listFamilyMembers() async {
    final result = await get('family-members');
    return result as List<dynamic>;
  }

  Future<Map<String, dynamic>> createChild({
    required String displayName,
    required String ageBand,
  }) async {
    final result = await post(
      'family-members/children',
      body: {'displayName': displayName, 'ageBand': ageBand},
    );
    return result as Map<String, dynamic>;
  }

  // --- Devices ---

  Future<List<dynamic>> listDevices() async {
    final result = await get('devices');
    return result as List<dynamic>;
  }

  Future<Map<String, dynamic>> enrollDevice({required String childId, String? model}) async {
    final result = await post(
      'devices/enroll',
      body: {'childId': childId, if (model != null) 'model': model},
    );
    return result as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendCommand({
    required String deviceId,
    required String type,
    Map<String, dynamic>? payload,
  }) async {
    final result = await post(
      'devices/$deviceId/commands',
      body: {'type': type, if (payload != null) 'payload': payload},
    );
    return result as Map<String, dynamic>;
  }

  // --- Policies ---

  Future<Map<String, dynamic>> getCurrentPolicy(String childId) async {
    final result = await get('policies/children/$childId/current');
    return result as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updatePolicy(
    String childId, {
    int? screenTimeMinutesPerDay,
    List<String>? blockedApps,
    Map<String, String>? sleepSchedule,
    required int expectedVersion,
  }) async {
    final result = await patch(
      'policies/children/$childId',
      body: {
        if (screenTimeMinutesPerDay != null) 'screenTimeMinutesPerDay': screenTimeMinutesPerDay,
        if (blockedApps != null) 'blockedApps': blockedApps,
        if (sleepSchedule != null) 'sleepSchedule': sleepSchedule,
        'expectedVersion': expectedVersion,
      },
    );
    return result as Map<String, dynamic>;
  }

  // --- Location ---

  Future<void> grantLocationConsent(String childId) async {
    await post('locations/consent/grant', body: {'childId': childId});
  }

  Future<void> revokeLocationConsent(String childId) async {
    await post('locations/consent/revoke', body: {'childId': childId});
  }

  Future<Map<String, dynamic>?> getLatestLocation(String childId) async {
    final result = await get('locations/children/$childId/latest');
    return result as Map<String, dynamic>?;
  }
}
