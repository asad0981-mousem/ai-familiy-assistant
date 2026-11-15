import 'package:ai_family_child/core/qr_codes.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('extractChildIdFromScan', () {
    test('یک UUID معتبر را همان‌طور که هست برمی‌گرداند', () {
      const uuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      expect(extractChildIdFromScan(uuid), uuid);
    });

    test('فاصله اضافی دور UUID را trim می‌کند', () {
      expect(
        extractChildIdFromScan('  3fa85f64-5717-4562-b3fc-2c963f66afa6  '),
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      );
    });

    test('حروف بزرگ UUID هم پذیرفته می‌شود', () {
      const uuid = '3FA85F64-5717-4562-B3FC-2C963F66AFA6';
      expect(extractChildIdFromScan(uuid), uuid);
    });

    test('null را null برمی‌گرداند (نه پرتاب خطا)', () {
      expect(extractChildIdFromScan(null), isNull);
    });

    test('رشته خالی یا متن غیرUUID را رد می‌کند', () {
      expect(extractChildIdFromScan(''), isNull);
      expect(extractChildIdFromScan('این یک کد ورود نیست'), isNull);
    });

    test('محتوای QR یک سایت دیگر (مثلاً URL) را رد می‌کند — تا اسکن اشتباهی کاربر را گیج نکند',
        () {
      expect(extractChildIdFromScan('https://example.com'), isNull);
    });

    test('JSON حاوی UUID را رد می‌کند — فرمت فقط خود UUID خام است، نه هیچ طرحواره دیگر', () {
      expect(extractChildIdFromScan('{"childId":"3fa85f64-5717-4562-b3fc-2c963f66afa6"}'), isNull);
    });
  });
}
