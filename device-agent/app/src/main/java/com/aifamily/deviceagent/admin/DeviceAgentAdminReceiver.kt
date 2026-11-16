package com.aifamily.deviceagent.admin

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * گیرنده Device Admin (نه Device Owner کامل) — فعال‌سازی آن از طریق دیالوگ استاندارد اندروید
 * (ACTION_ADD_DEVICE_ADMIN در [android.app.admin.DevicePolicyManager]) انجام می‌شود، نه
 * Provisioning در زمان Factory Reset. این یک قدم میانی آگاهانه است: با Device Admin عادی فقط
 * می‌توان lockNow()/wipeData() را واقعاً اجرا کرد (هر دو در [DeviceAdminPolicyExecutor] هستند)؛
 * دستوراتی مثل مسدودسازی اپ یا محدودیت زمان صفحه همچنان نیازمند Device Owner Mode کامل هستند
 * (آیتم باز مستندشده در device-agent/README.md).
 */
class DeviceAgentAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
    }

    companion object {
        fun componentName(context: Context): ComponentName =
            ComponentName(context, DeviceAgentAdminReceiver::class.java)
    }
}
