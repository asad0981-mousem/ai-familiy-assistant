import 'dart:convert';

import 'package:ai_family_parent/core/api_client.dart';
import 'package:ai_family_parent/core/secure_storage.dart';
import 'package:ai_family_parent/core/session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// پیاده‌سازی درون‌حافظه‌ای SecureStorage (خودمان، نه بسته flutter_secure_storage) برای تست واحد —
/// override کردن متدهای عمومی SecureStorage به‌جای Mock کردن پلتفرم‌چنل واقعی بسته، که در محیط
/// تست واحد (بدون دستگاه) اصلاً قابل فراخوانی نیست.
class _FakeSecureStorage extends SecureStorage {
  final Map<String, String> _store = {};

  @override
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    _store['access_token'] = accessToken;
    _store['refresh_token'] = refreshToken;
  }

  @override
  Future<String?> readAccessToken() async => _store['access_token'];

  @override
  Future<String?> readRefreshToken() async => _store['refresh_token'];

  @override
  Future<void> clear() async => _store.clear();
}

void main() {
  group('Session (اپ والد)', () {
    ApiClient buildApi() {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'user': {'id': 'parent-1', 'displayName': 'اسداله', 'email': 'a@b.com', 'role': 'parent'},
            'accessToken': 'access-1',
            'refreshToken': 'refresh-1',
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });
      return ApiClient(baseUrl: 'http://localhost:3000/api/v1', tokenProvider: () => null, client: client);
    }

    test('login نشست را پر می‌کند و در SecureStorage ذخیره می‌کند', () async {
      final fakeStorage = _FakeSecureStorage();
      final session = Session(api: buildApi(), secureStorage: fakeStorage);

      await session.login(email: 'a@b.com', password: 'x');

      expect(session.isAuthenticated, isTrue);
      expect(session.displayName, 'اسداله');
      expect(session.userId, 'parent-1');
      expect(await fakeStorage.readAccessToken(), 'access-1');
    });

    test('applyRefreshedTokens توکن‌های جدید را جایگزین می‌کند و در SecureStorage هم ذخیره می‌کند'
        ' (بدون نیاز به login دوباره)', () async {
      final fakeStorage = _FakeSecureStorage();
      final session = Session(api: buildApi(), secureStorage: fakeStorage);
      await session.login(email: 'a@b.com', password: 'x');

      await session.applyRefreshedTokens('new-access', 'new-refresh');

      expect(session.isAuthenticated, isTrue);
      expect(session.accessToken, 'new-access');
      expect(session.refreshToken, 'new-refresh');
      expect(await fakeStorage.readAccessToken(), 'new-access');
      expect(await fakeStorage.readRefreshToken(), 'new-refresh');
    });

    test('logout نشست را کامل پاک می‌کند', () async {
      final fakeStorage = _FakeSecureStorage();
      final session = Session(api: buildApi(), secureStorage: fakeStorage);
      await session.login(email: 'a@b.com', password: 'x');

      await session.logout();

      expect(session.isAuthenticated, isFalse);
      expect(session.userId, isNull);
      expect(await fakeStorage.readAccessToken(), isNull);
    });
  });
}
