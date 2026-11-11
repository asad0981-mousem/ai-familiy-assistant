/// دقیقاً مطابق پاسخ GET/PATCH .../policies/children/:childId/current در
/// backend/src/modules/policies/policies.service.ts — شامل version برای Optimistic Locking
/// (باید در آپدیت بعدی به‌صورت expectedVersion برگردانده شود، طبق UpdatePolicyDto).
class Policy {
  final int version;
  final int? screenTimeMinutesPerDay;
  final List<String> blockedApps;
  final SleepSchedule? sleepSchedule;

  Policy({
    required this.version,
    this.screenTimeMinutesPerDay,
    this.blockedApps = const [],
    this.sleepSchedule,
  });

  factory Policy.fromJson(Map<String, dynamic> json) {
    final rules = json['rules'] as Map<String, dynamic>? ?? {};
    final sleepRaw = rules['sleepSchedule'] as Map<String, dynamic>?;
    return Policy(
      version: json['version'] as int,
      screenTimeMinutesPerDay: rules['screenTimeMinutesPerDay'] as int?,
      blockedApps: (rules['blockedApps'] as List<dynamic>? ?? const [])
          .map((e) => e as String)
          .toList(),
      sleepSchedule: sleepRaw != null ? SleepSchedule.fromJson(sleepRaw) : null,
    );
  }
}

class SleepSchedule {
  final String start; // "HH:mm"
  final String end; // "HH:mm"

  SleepSchedule({required this.start, required this.end});

  factory SleepSchedule.fromJson(Map<String, dynamic> json) {
    return SleepSchedule(start: json['start'] as String, end: json['end'] as String);
  }

  Map<String, dynamic> toJson() => {'start': start, 'end': end};
}
