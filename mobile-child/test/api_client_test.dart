import 'dart:convert';

import 'package:ai_family_child/core/api_client.dart';
import 'package:ai_family_child/core/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('ApiClient', () {
    test('childLogin مسیر و بدنه دقیق مطابق ChildLoginDto سمت بک‌اند می‌فرستد (بدون Authorization)',
        () async {
      http.Request? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'user': {'id': 'child-1', 'displayName': 'کودک تست', 'role': 'child'},
            'accessToken': 'child-access-123',
            'refreshToken': 'child-refresh-123',
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => null,
        client: client,
      );

      final result = await api.childLogin(childId: 'child-1', pin: '1234');

      expect(capturedRequest!.method, 'POST');
      expect(capturedRequest!.url.toString(), 'http://localhost:3000/api/v1/auth/child-login');
      expect(capturedRequest!.headers.containsKey('Authorization'), isFalse);
      final sentBody = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(sentBody['childId'], 'child-1');
      expect(sentBody['pin'], '1234');
      expect(result['accessToken'], 'child-access-123');
    });

    test('childLogin با PIN نادرست (۴۰۱) به ApiException.isUnauthorized تبدیل می‌شود', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({'statusCode': 401, 'message': 'کد ورود یا PIN نادرست است'}),
          401,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => null,
        client: client,
      );

      expect(
        () => api.childLogin(childId: 'child-1', pin: '0000'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 401)
              .having((e) => e.isUnauthorized, 'isUnauthorized', true)
              .having((e) => e.message, 'message', 'کد ورود یا PIN نادرست است'),
        ),
      );
    });

    test('درخواست‌های احرازشده (sendTutorMessage) هدر Authorization Bearer را اضافه می‌کنند و'
        ' conversationId را فقط وقتی موجود است می‌فرستند', () async {
      http.Request? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'conversationId': 'conv-9',
            'reply': 'Great job! Let\'s try another word.',
            'provider': 'openai',
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'the-child-access-token',
        client: client,
      );

      final result = await api.sendTutorMessage(content: 'hi tutor');

      expect(capturedRequest!.headers['Authorization'], 'Bearer the-child-access-token');
      expect(capturedRequest!.url.toString(), 'http://localhost:3000/api/v1/ai-tutor/messages');
      final sentBody = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(sentBody['content'], 'hi tutor');
      expect(sentBody.containsKey('conversationId'), isFalse);
      expect(result['conversationId'], 'conv-9');
      expect(result['reply'], "Great job! Let's try another word.");
    });

    test('sendTutorMessage وقتی conversationId داده شود، آن را در بدنه می‌فرستد', () async {
      http.Request? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({'conversationId': 'conv-9', 'reply': 'ok', 'provider': 'openai'}),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        tokenProvider: () => 'token',
        client: client,
      );

      await api.sendTutorMessage(content: 'continue', conversationId: 'conv-9');

      final sentBody = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(sentBody['conversationId'], 'conv-9');
    });

    test('پاسخ خطای Validation (پیام آرایه‌ای) با کاما ترکیب می‌شود', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'statusCode': 400,
            'message': ['pin باید ۴ تا ۶ رقم عددی باشد'],
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
        await api.childLogin(childId: 'child-1', pin: 'abc');
        fail('باید خطا پرتاب می‌شد');
      } on ApiException catch (e) {
        expect(e.statusCode, 400);
        expect(e.isBadRequest, isTrue);
        expect(e.message, contains('pin باید ۴ تا ۶ رقم عددی باشد'));
      }
    });
  });
}
