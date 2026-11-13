import 'dart:convert';

import 'package:ai_family_child/core/api_client.dart';
import 'package:ai_family_child/core/secure_storage.dart';
import 'package:ai_family_child/core/session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// پیاده‌سازی درون‌حافظه‌ای SecureStorage (خودمان، نه بسته flutter_secure_storage) برای تست واحد —
/// override کردن متدهای عمومی SecureStorage به‌جای Mock کردن پلتفرم‌چنل واقعی بسته، که در محیط
/// تست واحد (بدون دستگاه) اصلاً قابل فراخوانی نیست.
class _FakeSecureStorage extends SecureStorage {
  final Map<String, String> _store = {};

  @override
  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String childId,
    required String displayName,
  }) async {
    _store['access_token'] = accessToken;
    _store['refresh_token'] = refreshToken;
    _store['child_id'] = childId;
    _store['display_name'] = displayName;
  }

  @override
  Future<String?> readAccessToken() async => _store['access_token'];

  @override
  Future<String?> readRefreshToken() async => _store['refresh_token'];

  @override
  Future<String?> readChildId() async => _store['child_id'];

  @override
  Future<String?> readDisplayName() async => _store['display_name'];

  @override
  Future<void> clearTokens() async {
    _store.remove('access_token');
    _store.remove('refresh_token');
  }

  @override
  Future<void> clearAll() async {
    _store.clear();
  }
}

void main() {
  group('Session (اپ کودک)', () {
    ApiClient buildApi() {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'user': {'id': 'child-1', 'displayName': 'سارا', 'role': 'child'},
            'accessToken': 'access-1',
            'refreshToken': 'refresh-1',
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });
      return ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => null,
        client: client,
      );
    }

    test('login نشست را از پاسخ childLogin واقعی پر می‌کند و در SecureStorage ذخیره می‌کند',
        () async {
      final fakeStorage = _FakeSecureStorage();
      final session = Session(api: buildApi(), secureStorage: fakeStorage);

      await session.login(childId: 'child-1', pin: '1234');

      expect(session.isAuthenticated, isTrue);
      expect(session.displayName, 'سارا');
      expect(session.childId, 'child-1');
      expect(await fakeStorage.readAccessToken(), 'access-1');
      expect(await fakeStorage.readChildId(), 'child-1');
    });

    test('logout فقط توکن‌ها را پاک می‌کند؛ childId به‌خاطرسپرده‌شده باقی می‌ماند', () async {
      final fakeStorage = _FakeSecureStorage();
      final session = Session(api: buildApi(), secureStorage: fakeStorage);
      await session.login(childId: 'child-1', pin: '1234');

      await session.logout();

      expect(session.isAuthenticated, isFalse);
      expect(session.childId, 'child-1'); // هنوز به‌خاطرسپرده‌شده
      expect(await fakeStorage.readAccessToken(), isNull);
      expect(await fakeStorage.readChildId(), 'child-1');
    });

    test('forgetAccount کد ورود را هم پاک می‌کند', () async {
      final fakeStorage = _FakeSecureStorage();
      final session = Session(api: buildApi(), secureStorage: fakeStorage);
      await session.login(childId: 'child-1', pin: '1234');

      await session.forgetAccount();

      expect(session.isAuthenticated, isFalse);
      expect(session.childId, isNull);
      expect(await fakeStorage.readChildId(), isNull);
    });
  });
}
