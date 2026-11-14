import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * تست‌های تمدید Access Token — بستن آیتم باز مستندشده در mobile-parent/README.md و
 * mobile-child/README.md («بدون Refresh Token خودکار، کاربر هر ۱۵ دقیقه Logout می‌شد»).
 */
describe("Refresh Token (e2e)", () => {
  let app: INestApplication;
  const unique = Date.now() + 3; // +3 تا با سایر فایل‌های e2e تداخل نداشته باشد

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

  async function registerParent(label: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        familyName: `خانواده Refresh ${label} ${unique}`,
        displayName: `والد ${label}`,
        email: `parent-refresh-${label}-${unique}@example-test.local`,
        password: "a-very-secure-password-123",
      })
      .expect(201);
    return { accessToken: res.body.accessToken as string, refreshToken: res.body.refreshToken as string };
  }

  it("با refreshToken واقعی والد، accessToken جدید صادر می‌شود و روی مسیر محافظت‌شده کار می‌کند", async () => {
    const parent = await registerParent("R1");

    const refreshRes = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: parent.refreshToken })
      .expect(200);

    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(typeof refreshRes.body.accessToken).toBe("string");

    await request(app.getHttpServer())
      .get("/api/v1/family-members")
      .set("Authorization", `Bearer ${refreshRes.body.accessToken}`)
      .expect(200);
  });

  it("با refreshToken واقعی کودک (صادرشده از child-login)، accessToken جدید نقش کودک را حفظ می‌کند", async () => {
    const parent = await registerParent("R2");
    const childRes = await request(app.getHttpServer())
      .post("/api/v1/family-members/children")
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({ displayName: "کودک تست Refresh", ageBand: "7-9" })
      .expect(201);
    const childId = childRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/family-members/children/${childId}/pin`)
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({ pin: "1234" })
      .expect(204);

    const childLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/child-login")
      .send({ childId, pin: "1234" })
      .expect(200);

    const refreshRes = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: childLoginRes.body.refreshToken })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post("/api/v1/ai-tutor/messages")
      .set("Authorization", `Bearer ${refreshRes.body.accessToken}`)
      .send({ content: "hi" });

    expect(res.status).not.toBe(401);
  });

  it("رشته نامعتبر (نه حتی JWT) با 401 رد می‌شود", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "این-یک-توکن-واقعی-نیست" });

    expect(res.status).toBe(401);
  });

  it("فرستادن accessToken به‌جای refreshToken با 401 رد می‌شود (Secret متفاوت)", async () => {
    const parent = await registerParent("R4");

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: parent.accessToken });

    expect(res.status).toBe(401);
  });

  it("بدنه بدون refreshToken با 400 رد می‌شود", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({});

    expect(res.status).toBe(400);
  });

  it("توکن دستگاه (role: device) هرگز نمی‌تواند از این مسیر تمدید شود", async () => {
    const parent = await registerParent("R6");
    const childRes = await request(app.getHttpServer())
      .post("/api/v1/family-members/children")
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({ displayName: "کودک برای دستگاه", ageBand: "10-12" })
      .expect(201);
    const childId = childRes.body.id as string;

    const enrollRes = await request(app.getHttpServer())
      .post("/api/v1/devices/enroll")
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({ childId })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: enrollRes.body.deviceToken });

    expect(res.status).toBe(401);
  });
});
