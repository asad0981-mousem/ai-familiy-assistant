package com.aifamily.deviceagent.admin

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent

/**
 * مسدودسازی/بازگشایی واقعی اپ‌ها — با DevicePolicyManager.setApplicationHidden (برای BLOCK_APP/
 * UNBLOCK_APP یک اپ مشخص) و setPackagesSuspended (برای SLEEP_MODE، روی همه اپ‌های قابل‌اجرای
 * کاربر). هر دو API محدود به Device Owner (یا Profile Owner) هستند — طبق مستندات رسمی اندروید؛
 * با Device Admin عادی SecurityException پرتاب می‌کنند.
 */
object AppSuspension {

    /** لیست پکیج‌های قابل‌اجرا از Launcher (CATEGORY_LAUNCHER) — به‌جز خود Device Agent. */
    fun launchablePackagesExceptSelf(context: Context): List<String> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolveInfos = context.packageManager.queryIntentActivities(intent, 0)
        return resolveInfos
            .map { it.activityInfo.packageName }
            .distinct()
            .filter { it != context.packageName }
    }

    /**
     * [hidden] = true یعنی برنامه از Launcher و اجرا پنهان/غیرفعال می‌شود (برای BLOCK_APP)؛
     * false یعنی بازگردانی (UNBLOCK_APP). SecurityException (اگر Device Owner نباشیم) و
     * IllegalArgumentException (اگر packageName نصب نباشد) هر دو false برمی‌گردانند، نه Exception.
     */
    fun setApplicationHidden(
        context: Context,
        adminComponent: android.content.ComponentName,
        packageName: String,
        hidden: Boolean,
    ): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return try {
            dpm.setApplicationHidden(adminComponent, packageName, hidden)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * تعلیق/رفع‌تعلیق همه اپ‌های کاربر (به‌جز خود Device Agent) — برای SLEEP_MODE و اجرای واقعی
     * محدودیت زمان صفحه (ScreenTimeEnforcementWorker). برمی‌گرداند: فهرست پکیج‌هایی که واقعاً
     * موفق به تغییر وضعیت‌شان نشدیم (خالی یعنی کامل موفق).
     */
    fun setAllLaunchableAppsSuspended(
        context: Context,
        adminComponent: android.content.ComponentName,
        suspended: Boolean,
    ): Array<String> {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val packages = launchablePackagesExceptSelf(context).toTypedArray()
        if (packages.isEmpty()) return emptyArray()
        return try {
            dpm.setPackagesSuspended(adminComponent, packages, suspended) ?: emptyArray()
        } catch (e: Exception) {
            packages // هیچ‌کدام موفق نشدند — همه را به‌عنوان Failed برمی‌گردانیم
        }
    }
}
