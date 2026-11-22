import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";

/**
 * ابلاغ Real-Time با FCM Push — مکمل Outbox Pull Pattern موجود (CommandPollWorker هر ۱۵ دقیقه)،
 * نه جایگزین آن. وقتی والد دستوری صادر می‌کند، این سرویس (در صورت وجود توکن FCM دستگاه) یک Push
 * «داده‌ای» (Data-only، بدون Notification قابل‌رویت) می‌فرستد که فقط باعث می‌شود Device Agent
 * بلافاصله به‌جای صبر تا Poll بعدی، یک Poll فوری انجام دهد — خود اجرای دستور همچنان فقط از مسیر
 * امضاشده/تاییدشده Pull اتفاق می‌افتد، نه از محتوای Push.
 *
 * محدودیت صادقانه مستندشده (جزئیات کامل در README اصلی و device-agent/README.md): ارسال واقعی
 * نیازمند یک پروژه واقعی Firebase و Service Account آن است که این مخزن کد ندارد و نمی‌تواند
 * داشته باشد (ساختن آن نیازمند حساب Google/مرورگر کاربر است، نه چیزی که از این محیط ممکن باشد).
 * بدون FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (مثلاً در CI یا توسعه محلی)، این سرویس عمداً و
 * صادقانه در حالت no-op اجرا می‌شود: initialize نمی‌کند، تلاشی برای ارسال نمی‌کند، و از همه مهم‌تر
 * هرگز جریان اصلی (صف‌شدن/اجرای دستور که از همان Pull قابل‌اعتماد تضمین می‌شود) را به‌خاطر نبود یا
 * شکست Push مسدود یا Throw نمی‌کند — چون Push فقط یک بهینه‌سازی تاخیر است، نه یک پیش‌نیاز درستی.
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly app: admin.app.App | null;
  private warnedOnce = false;

  constructor(config: ConfigService) {
    const base64 = config.get<string>("firebase.serviceAccountJsonBase64") || "";
    this.app = base64 ? initializeFirebaseApp(base64, this.logger) : null;
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  /**
   * ارسال Best-Effort — همیشه fulfilled می‌شود (هرگز reject نمی‌کند)، چون صدازننده (DevicesService)
   * نباید به‌خاطر شکست یک بهینه‌سازی تاخیر، ایجاد دستور را شکست بدهد.
   */
  async notifyWakeUp(fcmToken: string | null | undefined): Promise<void> {
    if (!fcmToken) return;

    if (!this.app) {
      if (!this.warnedOnce) {
        this.warnedOnce = true;
        this.logger.warn(
          "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 تنظیم نشده — FCM Push غیرفعال است؛ " +
            "دستورات همچنان از طریق Outbox Pull Pattern (حداکثر ۱۵ دقیقه تاخیر) تحویل داده می‌شوند.",
        );
      }
      return;
    }

    try {
      await this.app.messaging().send({
        token: fcmToken,
        data: { type: "wake_up_and_poll" },
        android: { priority: "high" },
      });
    } catch (error) {
      // شکست ارسال (توکن منقضی/باطل، قطعی شبکه و ...) عمداً فقط Log می‌شود — جریان اصلی دستور
      // (که از Pull تضمین می‌شود) تحت تاثیر قرار نمی‌گیرد.
      this.logger.warn(`ارسال FCM Push ناموفق بود (دستگاه همچنان از Pull مطلع می‌شود): ${error}`);
    }
  }
}

const FIREBASE_APP_NAME = "aifamily-push";

function initializeFirebaseApp(serviceAccountJsonBase64: string, logger: Logger): admin.app.App | null {
  try {
    // نام اختصاصی App (نه Default) تا چند نمونه‌سازی این سرویس در یک پردازش (مثلاً چند تست واحد
    // پشت‌سرهم) با خطای "already exists" برخورد نکند — نمونه قبلی همان نام را دوباره استفاده می‌کند.
    const existing = admin.apps.find((a) => a?.name === FIREBASE_APP_NAME);
    if (existing) return existing;

    const json = Buffer.from(serviceAccountJsonBase64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(json) as admin.ServiceAccount;
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, FIREBASE_APP_NAME);
  } catch (error) {
    // FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 تنظیم شده ولی نامعتبر است — صادقانه به no-op برمی‌گردیم
    // به‌جای کرش‌کردن کل بک‌اند روی یک قابلیت کمکی.
    logger.error(`مقداردهی Firebase Admin ناموفق بود (FCM Push غیرفعال باقی می‌ماند): ${error}`);
    return null;
  }
}
