import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'secure_storage.dart';

/// وضعیت نشست کودک. برخلاف اپ والد، یک childId «به‌خاطرسپرده‌شده» هم نگه می‌داریم تا کودک بعد
/// از اولین ورود فقط PIN را دوباره وارد کند، نه کل کد ورود (UUID) را.
class Session extends ChangeNotifier {
  final ApiClient api;
  final SecureStorage _secureStorage;

  String? _accessToken;
  String? _refreshToken;
  String? _childId;
  String? _displayName;
  bool _isLoading = true;

  Session({required this.api, SecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? SecureStorage();

  bool get isAuthenticated => _accessToken != null;
  bool get isLoading => _isLoading;
  String? get displayName => _displayName;
  String? get accessToken => _accessToken;
  String? get childId => _childId;

  /// کد ورود (childId) به‌خاطرسپرده‌شده از ورود قبلی — حتی اگر توکن منقضی شده باشد، برای پر کردن
  /// از پیش فیلد «کد ورود» در صفحه ورود استفاده می‌شود.
  String? get rememberedChildId => _childId;

  /// باید هنگام راه‌اندازی اپ یک‌بار صدا زده شود تا نشست قبلی (در صورت وجود) بازیابی شود.
  Future<void> restore() async {
    _accessToken = await _secureStorage.readAccessToken();
    _refreshToken = await _secureStorage.readRefreshToken();
    _childId = await _secureStorage.readChildId();
    _displayName = await _secureStorage.readDisplayName();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> login({required String childId, required String pin}) async {
    final result = await api.childLogin(childId: childId, pin: pin);
    _accessToken = result['accessToken'] as String;
    _refreshToken = result['refreshToken'] as String;
    final user = result['user'] as Map<String, dynamic>?;
    _displayName = user?['displayName'] as String?;
    _childId = (user?['id'] as String?) ?? childId;
    await _secureStorage.saveSession(
      accessToken: _accessToken!,
      refreshToken: _refreshToken!,
      childId: _childId!,
      displayName: _displayName ?? '',
    );
    notifyListeners();
  }

  /// فقط خروج از نشست فعلی — کد ورود (childId) را نگه می‌دارد تا دفعه بعد فقط PIN خواسته شود.
  Future<void> logout() async {
    _accessToken = null;
    _refreshToken = null;
    await _secureStorage.clearTokens();
    notifyListeners();
  }

  /// «تغییر حساب» — کد ورود به‌خاطرسپرده‌شده را هم پاک می‌کند (مثلاً وقتی دستگاه بین چند فرزند
  /// خانواده مشترک است).
  Future<void> forgetAccount() async {
    _accessToken = null;
    _refreshToken = null;
    _childId = null;
    _displayName = null;
    await _secureStorage.clearAll();
    notifyListeners();
  }

  /// اگر خطای 401 از ApiClient دریافت شد (توکن منقضی)، نشست را پاک می‌کند تا کودک دوباره با
  /// PIN وارد شود — فعلاً بدون Refresh Token خودکار (همان آیتم باز اپ والد).
  Future<void> handleUnauthorized(ApiException e) async {
    if (e.isUnauthorized) {
      await logout();
    }
  }
}
