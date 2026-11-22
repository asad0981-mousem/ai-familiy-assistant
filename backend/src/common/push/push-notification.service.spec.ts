import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PushNotificationService } from "./push-notification.service";

function buildModule(serviceAccountJsonBase64: string) {
  return Test.createTestingModule({
    providers: [
      PushNotificationService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            key === "firebase.serviceAccountJsonBase64" ? serviceAccountJsonBase64 : undefined,
        },
      },
    ],
  }).compile();
}

describe("PushNotificationService", () => {
  it(
    "وقتی FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 تنظیم نشده (دقیقاً همین حالت در CI)، " +
      "به‌صورت صریح no-op است — isConfigured=false و notifyWakeUp بدون خطا resolve می‌شود",
    async () => {
      const moduleRef = await buildModule("");
      const push = moduleRef.get(PushNotificationService);

      expect(push.isConfigured).toBe(false);
      await expect(push.notifyWakeUp("some-fcm-token")).resolves.toBeUndefined();
      await expect(push.notifyWakeUp(null)).resolves.toBeUndefined();
      await expect(push.notifyWakeUp(undefined)).resolves.toBeUndefined();
    },
  );

  it(
    "وقتی مقدار تنظیم‌شده Base64/JSON معتبر نیست، سرویس کرش نمی‌کند — همچنان no-op " +
      "باقی می‌ماند (fail-safe، نه fail-crash روی یک قابلیت کمکی)",
    async () => {
      const moduleRef = await buildModule(Buffer.from("not valid json").toString("base64"));
      const push = moduleRef.get(PushNotificationService);

      expect(push.isConfigured).toBe(false);
      await expect(push.notifyWakeUp("some-fcm-token")).resolves.toBeUndefined();
    },
  );
});
