import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'secure_storage.dart';

/// وضعیت نشست والد — نگه‌داری accessToken در حافظه (برای ApiClient.tokenProvider) و روی
/// SecureStorage (برای ماندگاری بین اجراهای اپ). با تغییر isAuthenticated کل درخت ویجت زیر
/// ChangeNotifierProvider بازسازی می‌شود (مسیر لاگین/هوم).
class Session extends ChangeNotifier {
  final ApiClient api;
  final SecureStorage _secureStorage;

  String? _accessToken;
  String? _refreshToken;
  String? _userId;
  String? _displayName;
  bool _isLoading = true;

  Session({required this.api, SecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? SecureStorage();

  bool get isAuthenticated => _accessToken != null;
  bool get isLoading => _isLoading;
  String? get displayName => _displayName;
  String? get accessToken => _accessToken;

  /// باید هنگام راه‌اندازی اپ یک‌بار صدا زده شود تا نشست قبلی (در صورت وجود) بازیابی شود.
  Future<void> restore() async {
    _accessToken = await _secureStorage.readAccessToken();
    _refreshToken = await _secureStorage.readRefreshToken();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> register({
    required String familyName,
    required String displayName,
    required String email,
    required String password,
  }) async {
    final result = await api.register(
      familyName: familyName,
      displayName: displayName,
      email: email,
      password: password,
    );
    await _applyAuthResult(result);
  }

  Future<void> login({required String email, required String password}) async {
    final result = await api.login(email: email, password: password);
    await _applyAuthResult(result);
  }

  Future<void> _applyAuthResult(Map<String, dynamic> result) async {
    _accessToken = result['accessToken'] as String;
    _refreshToken = result['refreshToken'] as String;
    final user = result['user'] as Map<String, dynamic>?;
    _displayName = user?['displayName'] as String?;
    _userId = user?['id'] as String?;
    await _secureStorage.saveTokens(accessToken: _accessToken!, refreshToken: _refreshToken!);
    notifyListeners();
  }

  Future<void> logout() async {
    _accessToken = null;
    _refreshToken = null;
    _userId = null;
    _displayName = null;
    await _secureStorage.clear();
    notifyListeners();
  }

  /// اگر خطای 401 از ApiClient دریافت شد (توکن منقضی)، نشست را پاک می‌کند تا کاربر به صفحه ورود
  /// برگردد؛ فراخوان باید catch کند و این متد را صدا بزند — فعلاً بدون Refresh Token خودکار
  /// (آیتم باز؛ باید قبل از انتشار واقعی اضافه شود).
  Future<void> handleUnauthorized(ApiException e) async {
    if (e.isUnauthorized) {
      await logout();
    }
  }
}
