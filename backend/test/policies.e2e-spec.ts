import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * تست‌های Policy Engine — شامل تایید واقعی بسته‌شدن آیتم باز قبلی:
 * «لغو Consent موقعیت مکانی باید بلافاصله به Device Agent ابلاغ شود».
 */
describe("Policy Engine (e2e)", () => {
  let app: INestApplication;
  const unique = Date.now() + 1; // +1 تا با security.e2e-spec.ts تداخل نداشته باشد

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
        familyName: `خانواده Policy ${label} ${unique}`,
        displayName: `والد ${label}`,
        email: `parent-policy-${label}-${unique}@example-test.local`,
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

  it("به‌روزرسانی Policy توسط والد: نسخه افزایش می‌یابد و Device Agent آن را می‌بیند", async () => {
    const family = await registerFamily("P1");
    const child = await createChild(family.accessToken);

    const first = await request(app.getHttpServer())
      .patch(`/api/v1/policies/children/${child}`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ screenTimeMinutesPerDay: 60 })
      .expect(200);

    expect(first.body.version).toBe(1);
    expect(first.body.rules.screenTimeMinutesPerDay).toBe(60);

    const second = await request(app.getHttpServer())
      .patch(`/api/v1/policies/children/${child}`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ blockedApps: ["com.example.game"] })
      .expect(200);

    expect(second.body.version).toBe(2);
    // ادغام جزئی — فیلد قبلی باید حفظ شده باشد
    expect(second.body.rules.screenTimeMinutesPerDay).toBe(60);
    expect(second.body.rules.blockedApps).toEqual(["com.example.game"]);
  });

  it("expectedVersion نادرست با 409 رد می‌شود (Optimistic Locking)", async () => {
    const family = await registerFamily("P2");
    const child = await createChild(family.accessToken);

    await request(app.getHttpServer())
      .patch(`/api/v1/policies/children/${child}`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ screenTimeMinutesPerDay: 30 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/policies/children/${child}`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ screenTimeMinutesPerDay: 45, expectedVersion: 99 });

    expect(res.status).toBe(409);
  });

  it("به‌روزرسانی Policy یک دستور SYNC_POLICY برای دستگاه فعال کودک صف می‌کند", async () => {
    const family = await registerFamily("P3");
    const child = await createChild(family.accessToken);
    const device = await enrollDevice(family.accessToken, child);

    await request(app.getHttpServer())
      .patch(`/api/v1/policies/children/${child}`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ screenTimeMinutesPerDay: 90 })
      .expect(200);

    const pending = await request(app.getHttpServer())
      .get("/api/v1/devices/commands/pending")
      .set("Authorization", `Bearer ${device.deviceToken}`)
      .expect(200);

    expect(pending.body.some((c: { type: string }) => c.type === "sync_policy")).toBe(true);
  });

  it("لغو Consent موقعیت مکانی بلافاصله یک SYNC_POLICY جدید برای Device Agent صف می‌کند", async () => {
    const family = await registerFamily("P4");
    const child = await createChild(family.accessToken);
    const device = await enrollDevice(family.accessToken, child);

    await request(app.getHttpServer())
      .post("/api/v1/locations/consent/grant")
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ childId: child })
      .expect(201);

    // خالی‌کردن صف دستورات موجود (مثلاً از enrollment) تا تست دقیق باشد
    await request(app.getHttpServer())
      .get("/api/v1/devices/commands/pending")
      .set("Authorization", `Bearer ${device.deviceToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/locations/consent/revoke")
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ childId: child })
      .expect(201);

    const pendingAfterRevoke = await request(app.getHttpServer())
      .get("/api/v1/devices/commands/pending")
      .set("Authorization", `Bearer ${device.deviceToken}`)
      .expect(200);

    const syncCommand = pendingAfterRevoke.body.find(
      (c: { type: string; payload: { reason?: string } }) => c.type === "sync_policy",
    );
    expect(syncCommand).toBeDefined();
    expect(syncCommand.payload.reason).toBe("location_consent_revoked");
  });
});
