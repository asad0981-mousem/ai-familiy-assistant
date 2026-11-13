import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// ذخیره‌سازی امن accessToken/refreshToken + آخرین «کد ورود» (childId) — کد ورود محرمانه نیست
/// (شبیه pairing code دستگاه) اما ذخیره آن باعث می‌شود کودک فقط یک‌بار آن را تایپ کند و دفعات
/// بعد فقط PIN را وارد کند.
class SecureStorage {
  final FlutterSecureStorage _storage;

  SecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _childIdKey = 'child_id';
  static const _displayNameKey = 'display_name';

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String childId,
    required String displayName,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _childIdKey, value: childId);
    await _storage.write(key: _displayNameKey, value: displayName);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<String?> readChildId() => _storage.read(key: _childIdKey);
  Future<String?> readDisplayName() => _storage.read(key: _displayNameKey);

  /// فقط توکن‌ها را پاک می‌کند (خروج از حساب)؛ childId را نگه می‌دارد تا دفعه بعد دوباره
  /// لازم نباشد کد ورود تایپ شود — فقط PIN دوباره خواسته می‌شود.
  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  /// پاک‌سازی کامل، شامل کد ورود — برای «تغییر حساب».
  Future<void> clearAll() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _childIdKey);
    await _storage.delete(key: _displayNameKey);
  }
}
