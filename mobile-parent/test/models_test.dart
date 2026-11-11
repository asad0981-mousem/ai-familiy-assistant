import 'package:ai_family_parent/models/device.dart';
import 'package:ai_family_parent/models/family_member.dart';
import 'package:ai_family_parent/models/policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FamilyMember.fromJson', () {
    test('کودک را به‌درستی تشخیص می‌دهد', () {
      final member = FamilyMember.fromJson({
        'id': 'u1',
        'displayName': 'سارا',
        'role': 'child',
        'ageBand': '7-9',
      });
      expect(member.isChild, isTrue);
      expect(member.ageBand, '7-9');
    });

    test('والد را به‌درستی تشخیص می‌دهد و ageBand می‌تواند null باشد', () {
      final member = FamilyMember.fromJson({
        'id': 'u2',
        'displayName': 'پدر',
        'role': 'parent',
      });
      expect(member.isChild, isFalse);
      expect(member.ageBand, isNull);
    });
  });

  group('Device.fromJson', () {
    test('فیلدهای اختیاری null را به‌درستی مدیریت می‌کند', () {
      final device = Device.fromJson({
        'id': 'd1',
        'childId': 'c1',
        'managementMode': 'standard',
        'status': 'active',
      });
      expect(device.model, isNull);
      expect(device.status, 'active');
    });
  });

  group('Policy.fromJson', () {
    test('rules تودرتو را درست باز می‌کند، شامل sleepSchedule', () {
      final policy = Policy.fromJson({
        'version': 3,
        'rules': {
          'screenTimeMinutesPerDay': 90,
          'blockedApps': ['com.a', 'com.b'],
          'sleepSchedule': {'start': '21:00', 'end': '07:00'},
        },
      });
      expect(policy.version, 3);
      expect(policy.screenTimeMinutesPerDay, 90);
      expect(policy.blockedApps, ['com.a', 'com.b']);
      expect(policy.sleepSchedule!.start, '21:00');
      expect(policy.sleepSchedule!.end, '07:00');
    });

    test('Policy پیش‌فرض (هنوز هیچ Policyای ثبت نشده) بدون خطا parse می‌شود', () {
      final policy = Policy.fromJson({
        'version': 0,
        'rules': {
          'screenTimeMinutesPerDay': null,
          'blockedApps': <dynamic>[],
          'sleepSchedule': null,
        },
      });
      expect(policy.version, 0);
      expect(policy.screenTimeMinutesPerDay, isNull);
      expect(policy.blockedApps, isEmpty);
      expect(policy.sleepSchedule, isNull);
    });
  });
}
