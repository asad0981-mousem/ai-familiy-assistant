package com.aifamily.deviceagent.admin

import android.app.admin.DevicePolicyManager
import android.content.Context

/**
 * بررسی واقعی وضعیت Device Owner — نه هیچ فرض یا ادعا، مستقیماً از
 * DevicePolicyManager.isDeviceOwnerApp خوانده می‌شود.
 *
 * نکته صادقانه مهم (جزئیات کامل در device-agent/README.md): فعال‌سازی واقعی Device Owner از طریق
 * QR Provisioning هنگام Factory Reset نیازمند میزبانی APK در یک آدرس عمومی پایدار (برای
 * Zero-Touch/Managed Provisioning واقعی) است — زیرساختی که این پروژه هنوز ندارد. مسیر واقعی و
 * تایید‌شده‌ای که این نسخه پشتیبانی می‌کند، فعال‌سازی از طریق ADB روی دستگاهی بدون حساب از قبل
 * اضافه‌شده است:
 *
 * ```
 * adb shell dpm set-device-owner com.aifamily.deviceagent/.admin.DeviceAgentAdminReceiver
 * ```
 *
 * این دقیقاً همان روشی است که اکثر راهکارهای EMM/MDM برای نصب‌های Pilot/Sideload مستند می‌کنند؛
 * بعد از اجرای موفق آن، این کلاس true برمی‌گرداند و MainActivity آن را به بک‌اند گزارش می‌دهد.
 */
object DeviceOwnerStatus {
    fun isDeviceOwner(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isDeviceOwnerApp(context.packageName)
    }
}
