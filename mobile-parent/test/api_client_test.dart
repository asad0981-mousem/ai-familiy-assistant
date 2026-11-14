import 'dart:convert';

import 'package:ai_family_parent/core/api_client.dart';
import 'package:ai_family_parent/core/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('ApiClient', () {
    test('register فیلدهای دقیق مطابق RegisterDto سمت بک‌اند می‌فرستد', () async {
      http.Request? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'user': {'id': 'u1', 'displayName': 'Asad', 'email': 'a@b.com', 'role': 'parent'},
            'accessToken': 'access-123',
            'refreshToken': 'refresh-123',
          }),
          201,
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => null,
        client: client,
      );

      final result = await api.register(
        familyName: 'خانواده تست',
        displayName: 'Asad',
        email: 'a@b.com',
        password: 'a-very-secure-password-123',
      );

      expect(capturedRequest!.url.toString(), 'http://localhost:3000/api/v1/auth/register');
      expect(capturedRequest!.headers.containsKey('Authorization'), isFalse);
      final sentBody = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(sentBody['familyName'], 'خانواده تست');
      expect(sentBody['email'], 'a@b.com');
      expect(result['accessToken'], 'access-123');
    });

    test('درخواست‌های احرازشده هدر Authorization Bearer را با توکن فعلی اضافه می‌کنند', () async {
      String? capturedAuthHeader;
      final client = MockClient((request) async {
        capturedAuthHeader = request.headers['Authorization'];
        return http.Response(jsonEncode([]), 200);
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'the-current-access-token',
        client: client,
      );

      await api.listFamilyMembers();

      expect(capturedAuthHeader, 'Bearer the-current-access-token');
    });

    test('پاسخ خطای سرور (پیام رشته‌ای) به ApiException با statusCode درست تبدیل می‌شود', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({'statusCode': 409, 'message': 'نسخه منقضی شده است'}),
          409,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'token',
        client: client,
      );

      expect(
        () => api.updatePolicy('child-1', expectedVersion: 1),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 409)
              .having((e) => e.isConflict, 'isConflict', true)
              .having((e) => e.message, 'message', 'نسخه منقضی شده است'),
        ),
      );
    });

    test('پاسخ خطای Validation (پیام آرایه‌ای) با کاما ترکیب می‌شود', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'statusCode': 400,
            'message': ['email باید یک ایمیل معتبر باشد', 'password خیلی کوتاه است'],
          }),
          400,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => null,
        client: client,
      );

      try {
        await api.login(email: 'bad', password: 'x');
        fail('باید خطا پرتاب می‌شد');
      } on ApiException catch (e) {
        expect(e.statusCode, 400);
        expect(e.message, contains('email باید یک ایمیل معتبر باشد'));
        expect(e.message, contains('password خیلی کوتاه است'));
      }
    });

    test('updatePolicy مسیر و بدنه دقیق PATCH را می‌سازد (شامل expectedVersion)', () async {
      http.Request? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({'version': 2, 'rules': {'screenTimeMinutesPerDay': 60, 'blockedApps': []}}),
          200,
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'token',
        client: client,
      );

      await api.updatePolicy(
        'child-42',
        screenTimeMinutesPerDay: 60,
        expectedVersion: 1,
      );

      expect(capturedRequest!.method, 'PATCH');
      expect(
        capturedRequest!.url.toString(),
        'http://localhost:3000/api/v1/policies/children/child-42',
      );
      final body = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(body['screenTimeMinutesPerDay'], 60);
      expect(body['expectedVersion'], 1);
      expect(body.containsKey('blockedApps'), isFalse); // فقط فیلدهای ارسالی باید وجود داشته باشند
    });

    test(
        'روی ۴۰۱ یک‌بار تلاش برای تمدید توکن می‌کند (POST /auth/refresh) و درخواست اصلی را با'
        ' توکن جدید دوباره می‌فرستد', () async {
      var listCallCount = 0;
      String accessTokenHolder = 'expired-token';
      String refreshTokenHolder = 'the-refresh-token';
      String? refreshedAccess;
      String? refreshedRefresh;

      final client = MockClient((request) async {
        if (request.url.path.endsWith('/auth/refresh')) {
          expect(request.headers.containsKey('Authorization'), isFalse);
          final sentBody = jsonDecode(request.body) as Map<String, dynamic>;
          expect(sentBody['refreshToken'], 'the-refresh-token');
          return http.Response(
            jsonEncode({'accessToken': 'new-access-token', 'refreshToken': 'new-refresh-token'}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        if (request.url.path.endsWith('/family-members')) {
          listCallCount++;
          if (listCallCount == 1) {
            expect(request.headers['Authorization'], 'Bearer expired-token');
            return http.Response(
              jsonEncode({'statusCode': 401, 'message': 'توکن نامعتبر است'}),
              401,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }
          expect(request.headers['Authorization'], 'Bearer new-access-token');
          return http.Response(
            jsonEncode(<dynamic>[]),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        fail('مسیر غیرمنتظره: ${request.url}');
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => accessTokenHolder,
        refreshTokenProvider: () => refreshTokenHolder,
        onTokensRefreshed: (access, refresh) {
          accessTokenHolder = access;
          refreshTokenHolder = refresh;
          refreshedAccess = access;
          refreshedRefresh = refresh;
        },
        client: client,
      );

      final result = await api.listFamilyMembers();

      expect(result, isEmpty);
      expect(refreshedAccess, 'new-access-token');
      expect(refreshedRefresh, 'new-refresh-token');
      expect(listCallCount, 2);
    });

    test(
        'اگر تمدید توکن هم شکست بخورد، خطای ۴۰۱ اصلی پرتاب می‌شود و onRefreshFailed صدا زده'
        ' می‌شود (نه یک حلقه بی‌پایان)', () async {
      var refreshFailedCalled = false;
      var refreshCallCount = 0;

      final client = MockClient((request) async {
        if (request.url.path.endsWith('/auth/refresh')) {
          refreshCallCount++;
          return http.Response(
            jsonEncode({'statusCode': 401, 'message': 'توکن تازه‌سازی نامعتبر یا منقضی است'}),
            401,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response(
          jsonEncode({'statusCode': 401, 'message': 'توکن نامعتبر است'}),
          401,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'expired-token',
        refreshTokenProvider: () => 'expired-refresh-token',
        onRefreshFailed: () => refreshFailedCalled = true,
        client: client,
      );

      await expectLater(
        () => api.listFamilyMembers(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 401)
              .having((e) => e.message, 'message', 'توکن نامعتبر است'),
        ),
      );
      expect(refreshFailedCalled, isTrue);
      expect(refreshCallCount, 1); // فقط یک‌بار تلاش، نه حلقه تکراری
    });

    test('درخواست بدون Authentication (withAuth: false) هرگز تمدید توکن را امتحان نمی‌کند، حتی روی ۴۰۱',
        () async {
      var refreshCalled = false;
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/auth/refresh')) {
          refreshCalled = true;
          return http.Response(
            jsonEncode({'accessToken': 'x', 'refreshToken': 'y'}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response(
          jsonEncode({'statusCode': 401, 'message': 'ایمیل یا رمز عبور نادرست است'}),
          401,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => null,
        refreshTokenProvider: () => 'some-refresh-token',
        client: client,
      );

      await expectLater(
        () => api.login(email: 'a@b.com', password: 'wrong'),
        throwsA(isA<ApiException>()),
      );
      expect(refreshCalled, isFalse);
    });

    test('setChildPin مسیر PATCH صحیح را با بدنه PIN می‌سازد و پاسخ 204 بدون بدنه را می‌پذیرد', () async {
      http.Request? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response('', 204);
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'token',
        client: client,
      );

      await api.setChildPin(childId: 'child-7', pin: '1234');

      expect(capturedRequest!.method, 'PATCH');
      expect(
        capturedRequest!.url.toString(),
        'http://localhost:3000/api/v1/family-members/children/child-7/pin',
      );
      final body = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(body['pin'], '1234');
    });
  });
}
