import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * تست‌های End-to-End برای سه قانون غیرقابل‌مذاکره (BLOCKER) مستندشده در فاز ۱۰:
 *  - TC-SEC-010/011: جلوگیری از IDOR بین خانواده‌ها (Cross-Family Authorization)
 *  - TC-LOC-019: Consent Gate برای موقعیت مکانی
 * این‌ها روی یک دیتابیس PostgreSQL واقعی اجرا می‌شوند (نه Mock) — طبق همان الگوی CI که
 * Migration‌ها را هم روی DB واقعی اجرا و تایید می‌کند.
 */
describe("Security invariants (e2e)", () => {
  let app: INestApplication;
  const unique = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerFamily(label: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        familyName: `خانواده ${label} ${unique}`,
        displayName: `والد ${label}`,
        email: `parent-${label}-${unique}@example-test.local`,
        password: "a-very-secure-password-123",
      })
      .expect(201);
    return { accessToken: res.body.accessToken as string };
  }

  async function createChild(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/family-members/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ displayName: "کودک تست", ageBand: "7-9" })
      .expect(201);
    return res.body.id as string;
  }

  async function enrollDevice(accessToken: string, childId: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/devices/enroll")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ childId })
      .expect(201);
    return { deviceId: res.body.device.id as string, deviceToken: res.body.deviceToken as string };
  }

  describe("Cross-Family Authorization (IDOR) — TC-SEC-010/011", () => {
    it("والد خانواده B نمی‌تواند روی دستگاه خانواده A دستور صادر کند", async () => {
      const familyA = await registerFamily("A");
      const childA = await createChild(familyA.accessToken);
      const deviceA = await enrollDevice(familyA.accessToken, childA);

      const familyB = await registerFamily("B");

      const res = await request(app.getHttpServer())
        .post(`/api/v1/devices/${deviceA.deviceId}/commands`)
        .set("Authorization", `Bearer ${familyB.accessToken}`)
        .send({ type: "lock_device" });

      // باید 404 باشد (نه 403) تا enumeration امکان‌پذیر نباشد — طبق طراحی DevicesService
      expect(res.status).toBe(404);
    });

    it("والد خانواده B نمی‌تواند دستگاه‌های خانواده A را در فهرست خودش ببیند", async () => {
      const familyA = await registerFamily("A2");
      const childA = await createChild(familyA.accessToken);
      await enrollDevice(familyA.accessToken, childA);

      const familyB = await registerFamily("B2");
      const res = await request(app.getHttpServer())
        .get("/api/v1/devices")
        .set("Authorization", `Bearer ${familyB.accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe("Location Consent Gate — TC-LOC-019", () => {
    it("گزارش موقعیت مکانی بدون رضایت فعال رد می‌شود", async () => {
      const family = await registerFamily("LOC1");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      const res = await request(app.getHttpServer())
        .post("/api/v1/locations/report")
        .set("Authorization", `Bearer ${device.deviceToken}`)
        .send({ lat: 35.7153, lng: 51.4043, capturedAt: new Date().toISOString() });

      expect(res.status).toBe(403);
    });

    it("بعد از اعطای رضایت، گزارش موقعیت موفق می‌شود و والد مقدار صحیح (رمزگشایی‌شده) را می‌بیند", async () => {
      const family = await registerFamily("LOC2");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      await request(app.getHttpServer())
        .post("/api/v1/locations/consent/grant")
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ childId: child })
        .expect(201);

      const lat = 35.7153;
      const lng = 51.4043;
      await request(app.getHttpServer())
        .post("/api/v1/locations/report")
        .set("Authorization", `Bearer ${device.deviceToken}`)
        .send({ lat, lng, capturedAt: new Date().toISOString() })
        .expect(201);

      const latest = await request(app.getHttpServer())
        .get(`/api/v1/locations/children/${child}/latest`)
        .set("Authorization", `Bearer ${family.accessToken}`)
        .expect(200);

      expect(latest.body.lat).toBeCloseTo(lat, 4);
      expect(latest.body.lng).toBeCloseTo(lng, 4);
    });

    it("بعد از لغو رضایت، گزارش موقعیت دوباره رد می‌شود", async () => {
      const family = await registerFamily("LOC3");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      await request(app.getHttpServer())
        .post("/api/v1/locations/consent/grant")
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ childId: child })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/v1/locations/consent/revoke")
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ childId: child })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post("/api/v1/locations/report")
        .set("Authorization", `Bearer ${device.deviceToken}`)
        .send({ lat: 35.7153, lng: 51.4043, capturedAt: new Date().toISOString() });

      expect(res.status).toBe(403);
    });
  });

  describe("Command idempotency", () => {
    it("دستور صادرشده با idempotency key یکتا ذخیره و وضعیت اولیه آن queued است", async () => {
      const family = await registerFamily("CMD1");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/devices/${device.deviceId}/commands`)
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ type: "lock_device" })
        .expect(201);

      expect(res.body.status).toBe("queued");
      expect(res.body.idempotencyKey).toBeDefined();
    });

    it("WIPE_DATA با Device Admin عادی هم مجاز است (دیگر نیازمند Device Owner نیست)", async () => {
      // اصلاح صادقانه نسبت به نسخه قبلی این تست: WIPE_DATA در عمل با Device Admin عادی
      // (DevicePolicyManager.wipeData پس از ACTION_ADD_DEVICE_ADMIN) هم اجرا می‌شود — جزئیات در
      // device-agent/.../work/CommandExecutor.kt — پس دیگر نباید در Standard Mode رد شود.
      const family = await registerFamily("CMD2");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/devices/${device.deviceId}/commands`)
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ type: "wipe_data" })
        .expect(201);

      expect(res.body.status).toBe("queued");
    });

    it("BLOCK_APP در Standard Mode رد می‌شود (نیازمند Device Owner واقعی است)", async () => {
      const family = await registerFamily("CMD3");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/devices/${device.deviceId}/commands`)
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ type: "block_app", payload: { packageName: "com.example.game" } });

      expect(res.status).toBe(400);
    });

    it("بعد از این‌که Device Agent واقعاً Device Owner بودن را گزارش می‌دهد، BLOCK_APP مجاز می‌شود", async () => {
      const family = await registerFamily("CMD4");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      // والد نمی‌تواند این مقدار را مستقیماً تنظیم کند — فقط خود دستگاه (توکن role=device) می‌تواند.
      const forbidden = await request(app.getHttpServer())
        .patch("/api/v1/devices/management-mode")
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ managementMode: "device_owner" });
      expect(forbidden.status).toBe(403);

      await request(app.getHttpServer())
        .patch("/api/v1/devices/management-mode")
        .set("Authorization", `Bearer ${device.deviceToken}`)
        .send({ managementMode: "device_owner" })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/devices/${device.deviceId}/commands`)
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ type: "block_app", payload: { packageName: "com.example.game" } })
        .expect(201);

      expect(res.body.status).toBe("queued");
    });
  });

  describe("FCM Push — گزارش توکن و Graceful Degradation", () => {
    it("والد نمی‌تواند توکن FCM را تنظیم کند؛ فقط خود دستگاه مجاز است", async () => {
      const family = await registerFamily("FCM1");
      const child = await createChild(family.accessToken);
      const device = await enrollDevice(family.accessToken, child);

      const forbidden = await request(app.getHttpServer())
        .patch("/api/v1/devices/fcm-token")
        .set("Authorization", `Bearer ${family.accessToken}`)
        .send({ fcmToken: "fake-token-should-be-rejected" });
      expect(forbidden.status).toBe(403);

      await request(app.getHttpServer())
        .patch("/api/v1/devices/fcm-token")
        .set("Authorization", `Bearer ${device.deviceToken}`)
        .send({ fcmToken: "ci-test-fcm-token-value" })
        .expect(200);
    });

    it(
      "صدور دستور حتی وقتی FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 تنظیم نشده (مثل این محیط CI) " +
        "همچنان موفق است — Push فقط بهینه‌سازی تاخیر است، نه پیش‌نیاز درستی (PushNotificationService " +
        "باید به‌صورت no-op اجرا شود، نه این‌که ایجاد دستور را Throw/مسدود کند)",
      async () => {
        const family = await registerFamily("FCM2");
        const child = await createChild(family.accessToken);
        const device = await enrollDevice(family.accessToken, child);

        await request(app.getHttpServer())
          .patch("/api/v1/devices/fcm-token")
          .set("Authorization", `Bearer ${device.deviceToken}`)
          .send({ fcmToken: "ci-test-fcm-token-value" })
          .expect(200);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/devices/${device.deviceId}/commands`)
          .set("Authorization", `Bearer ${family.accessToken}`)
          .send({ type: "lock_device" })
          .expect(201);

        expect(res.body.status).toBe("queued");
      },
    );
  });
});
