import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * تست‌های ورود کودک با PIN — بستن آیتم باز مستندشده در auth.service.ts/README («ورود واقعی
 * کودک هنوز پیاده‌سازی نشده»، که در device-agent/README.md و mobile-parent/README.md هم به آن
 * اشاره شده بود).
 */
describe("Child Login (e2e)", () => {
  let app: INestApplication;
  const unique = Date.now() + 2; // +2 تا با سایر فایل‌های e2e تداخل نداشته باشد

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
        familyName: `خانواده PIN ${label} ${unique}`,
        displayName: `والد ${label}`,
        email: `parent-pin-${label}-${unique}@example-test.local`,
        password: "a-very-secure-password-123",
      })
      .expect(201);
    return { accessToken: res.body.accessToken as string };
  }

  async function createChild(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/family-members/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ displayName: "کودک تست PIN", ageBand: "7-9" })
      .expect(201);
    return res.body.id as string;
  }

  it("والد PIN تنظیم می‌کند و کودک با همان PIN وارد می‌شود", async () => {
    const family = await registerFamily("P1");
    const childId = await createChild(family.accessToken);

    await request(app.getHttpServer())
      .patch(`/api/v1/family-members/children/${childId}/pin`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ pin: "1234" })
      .expect(204);

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/child-login")
      .send({ childId, pin: "1234" })
      .expect(200);

    expect(loginRes.body.user.role).toBe("child");
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();
  });

  it("PIN نادرست با 401 رد می‌شود", async () => {
    const family = await registerFamily("P2");
    const childId = await createChild(family.accessToken);

    await request(app.getHttpServer())
      .patch(`/api/v1/family-members/children/${childId}/pin`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ pin: "5555" })
      .expect(204);

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/child-login")
      .send({ childId, pin: "9999" });

    expect(res.status).toBe(401);
  });

  it("کودکی که هنوز PIN ندارد نمی‌تواند وارد شود (401، نه خطای جداگانه که وجودش را لو بدهد)", async () => {
    const family = await registerFamily("P3");
    const childId = await createChild(family.accessToken);

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/child-login")
      .send({ childId, pin: "1234" });

    expect(res.status).toBe(401);
  });

  it("والد خانواده دیگر نمی‌تواند PIN کودک این خانواده را تنظیم کند (404، جلوگیری از IDOR)", async () => {
    const familyA = await registerFamily("P4A");
    const childIdA = await createChild(familyA.accessToken);

    const familyB = await registerFamily("P4B");

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/family-members/children/${childIdA}/pin`)
      .set("Authorization", `Bearer ${familyB.accessToken}`)
      .send({ pin: "1234" });

    expect(res.status).toBe(404);
  });

  it("فرمت نامعتبر PIN (غیرعددی یا طول اشتباه) با 400 رد می‌شود", async () => {
    const family = await registerFamily("P5");
    const childId = await createChild(family.accessToken);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/family-members/children/${childId}/pin`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ pin: "abc" });

    expect(res.status).toBe(400);
  });

  it("توکن کودک صادرشده از child-login برای فراخوانی AI Tutor معتبر است", async () => {
    const family = await registerFamily("P6");
    const childId = await createChild(family.accessToken);

    await request(app.getHttpServer())
      .patch(`/api/v1/family-members/children/${childId}/pin`)
      .set("Authorization", `Bearer ${family.accessToken}`)
      .send({ pin: "4321" })
      .expect(204);

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/child-login")
      .send({ childId, pin: "4321" })
      .expect(200);

    const childToken = loginRes.body.accessToken as string;

    // فقط بررسی می‌کنیم که Guard توکن را معتبر می‌شناسد (نه 401) — نه رفتار کامل AI Tutor که در
    // ai-tutor.e2e-spec.ts با Mock واقعی پوشش داده شده.
    const res = await request(app.getHttpServer())
      .post("/api/v1/ai-tutor/messages")
      .set("Authorization", `Bearer ${childToken}`)
      .send({ content: "hi" });

    expect(res.status).not.toBe(401);
  });
});
