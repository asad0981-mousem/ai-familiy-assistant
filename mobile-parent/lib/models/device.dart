/// دقیقاً مطابق Entity Device سمت بک‌اند (backend/src/modules/devices/entities/device.entity.ts)
/// که در پاسخ GET /api/v1/devices به‌صورت خام (بدون DTO جداگانه) برمی‌گردد.
class Device {
  final String id;
  final String childId;
  final String managementMode; // "standard" | "device_owner"
  final String status; // "pending_enrollment" | "active" | "suspended" | "removed"
  final String? model;
  final String? osVersion;
  final String? agentVersion;
  final String? lastSeenAt;

  Device({
    required this.id,
    required this.childId,
    required this.managementMode,
    required this.status,
    this.model,
    this.osVersion,
    this.agentVersion,
    this.lastSeenAt,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] as String,
      childId: json['childId'] as String,
      managementMode: json['managementMode'] as String,
      status: json['status'] as String,
      model: json['model'] as String?,
      osVersion: json['osVersion'] as String?,
      agentVersion: json['agentVersion'] as String?,
      lastSeenAt: json['lastSeenAt'] as String?,
    );
  }
}

/// نوع‌های دستور — دقیقاً مطابق CommandType در
/// backend/src/modules/devices/entities/device-command.entity.ts
/// (باید هم‌زمان با آن و با device-agent/.../model/DeviceCommand.kt به‌روز بماند).
enum CommandType {
  lockDevice('lock_device', 'قفل دستگاه'),
  unlockDevice('unlock_device', 'باز کردن قفل'),
  setScreenTimeLimit('set_screen_time_limit', 'محدودیت زمان صفحه'),
  blockApp('block_app', 'مسدودسازی اپ'),
  unblockApp('unblock_app', 'رفع مسدودسازی اپ'),
  forceLocationUpdate('force_location_update', 'به‌روزرسانی فوری موقعیت'),
  sleepModeEnable('sleep_mode_enable', 'فعال‌سازی حالت خواب'),
  sleepModeDisable('sleep_mode_disable', 'غیرفعال‌سازی حالت خواب'),
  syncPolicy('sync_policy', 'همگام‌سازی Policy'),
  sendParentMessage('send_parent_message', 'ارسال پیام به کودک'),
  remoteAlarm('remote_alarm', 'هشدار از راه دور'),
  wipeData('wipe_data', 'پاک‌سازی داده دستگاه');

  final String wireValue;
  final String label;

  const CommandType(this.wireValue, this.label);
}
