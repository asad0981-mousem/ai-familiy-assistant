import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { OpenAiProvider } from "../src/modules/ai-tutor/providers/openai.provider";
import { AnthropicProvider } from "../src/modules/ai-tutor/providers/anthropic.provider";
import { AiCompletionRequest, AiCompletionResult } from "../src/modules/ai-tutor/providers/ai-provider.port";
import { AiMemory, MemoryLevel } from "../src/modules/ai-tutor/entities/ai-memory.entity";
import { JwtPayload } from "../src/modules/auth/strategies/jwt.strategy";

/**
 * تست‌های End-to-End برای ماژول AI Tutor — طبق فصل ۱۳/۱۴ Blueprint نهایی:
 *  - جداسازی معماری Safety Agent از منطق Tutor (SEC-040): فیلتر ایمنی باید قبل از هر فراخوانی
 *    Provider اجرا شود — تایید می‌شود با بررسی اینکه هیچ Provider جعلی صدا زده نشده.
 *  - Fallback Orchestration واقعی (نه فقط Unit Test روی یک تابع): وقتی Provider اصلی خطا می‌دهد،
 *    AiProviderFactory واقعی (نه جعلی) باید به Provider پشتیبان سوییچ کند.
 *  - Tenant Isolation روی مکالمات (جلوگیری از IDOR مشابه الگوی TC-SEC-010/011).
 *  - حافظه ۴‌سطحی: محتوای LEARNER_PROFILE/FAMILY_CONTEXT باید در System Prompt ارسالی به AI دیده شود
 *    و حافظه خانواده دیگر هرگز نشت نکند (Memory Isolation BLOCKER — TC-AI-020).
 *
 * Provider های واقعی OpenAI/Anthropic به‌صورت عمدی Mock شده‌اند (نه AiProviderFactory که منطق
 * Fallback واقعی در آن است) — چون این‌ها Adapterهای شبکه‌ای به API پولی/غیرقطعی خارجی هستند؛
 * AiProviderFactory و تمام منطق دامنه (Safety، Tenant Isolation، Memory) واقعی و بدون Mock اجرا می‌شوند.
 *
 * محدودیت شناخته‌شده: در کدبیس فعلی مسیر ورود کودک (PIN/QR همراه Device Agent) هنوز پیاده‌سازی
 * نشده (طبق کامنت auth.service.ts). به همین دلیل توکن کودک اینجا با همان JwtService/Secret واقعی
 * برنامه (دقیقاً همان قرارداد Payload که AuthService.issueTokens تولید می‌کند) صادر می‌شود —
 * این آیتم باز (پیاده‌سازی ورود واقعی کودک) در README مستند می‌شود.
 */
describe("AI Tutor (e2e)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let configService: ConfigService;
  let aiMemoryRepo: Repository<AiMemory>;
  const unique = Date.now();

  const fakeResult = (provider: string, content = "Great job! Let's practice more."): AiCompletionResult => ({
    content,
    provider,
    model: `${provider}-fake-model`,
  });

  let openAiComplete: jest.Mock<Promise<AiCompletionResult>, [AiCompletionRequest]>;
  let anthropicComplete: jest.Mock<Promise<AiCompletionResult>, [AiCompletionRequest]>;

  const fakeOpenAi: OpenAiProvider = {
    name: "openai",
    complete: (req: AiCompletionRequest) => openAiComplete(req),
  } as unknown as OpenAiProvider;

  const fakeAnthropic: AnthropicProvider = {
    name: "anthropic",
    complete: (req: AiCompletionRequest) => anthropicComplete(req),
  } as unknown as AnthropicProvider;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OpenAiProvider)
      .useValue(fakeOpenAi)
      .overrideProvider(AnthropicProvider)
      .useValue(fakeAnthropic)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    configService = moduleFixture.get(ConfigService);
    aiMemoryRepo = moduleFixture.get(getRepositoryToken(AiMemory));
  });

  beforeEach(() => {
    openAiComplete = jest.fn().mockResolvedValue(fakeResult("openai"));
    anthropicComplete = jest.fn().mockResolvedValue(fakeResult("anthropic"));
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerFamily(label: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        familyName: `خانواده Tutor ${label} ${unique}`,
        displayName: `والد ${label}`,
        email: `parent-tutor-${label}-${unique}@example-test.local`,
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

  /**
   * صدور توکن کودک — دقیقاً با همان قرارداد Payload که AuthService.issueTokens واقعی تولید می‌کند
   * (sub/familyId/role) و با Secret واقعی برنامه، تا تا زمان پیاده‌سازی ورود واقعی کودک، رفتار
   * Guard/Strategy به‌طور کامل و صادقانه آزمایش شود.
   */
  function childToken(childId: string, familyId: string): string {
    const payload: JwtPayload = { sub: childId, familyId, role: "child" };
    return jwtService.sign(payload, {
      secret: configService.get<string>("jwt.accessSecret"),
      expiresIn: configService.get<string>("jwt.accessExpiresIn"),
    });
  }

  async function setupFamilyWithChild(label: string) {
    const family = await registerFamily(label);
    const childId = await createChild(family.accessToken);
    // familyId را از توکن والد نمی‌توان مستقیم خواند (JWT امضا شده مات است)؛ از طریق لیست اعضا تایید می‌کنیم
    // که childId به همین خانواده تعلق دارد و familyId واقعی را از رکورد ai_memories/کوئری جدا استخراج نمی‌کنیم —
    // در عوض بعد از اولین پیام، conversation.familyId از DB واقعی می‌آید. برای صدور توکن کودک، familyId باید
    // از decode توکن والد به‌دست بیاید چون ساختار Payload یکسان است.
    const decoded = jwtService.decode(family.accessToken) as JwtPayload;
    return { parentToken: family.accessToken, childId, familyId: decoded.familyId };
  }

  describe("مسیر عادی و جداسازی خانواده‌ها", () => {
    it("پیام کودک ذخیره، ایمنی بررسی و پاسخ از Provider اصلی برمی‌گردد", async () => {
      const { childId, familyId } = await setupFamilyWithChild("T1");
      const token = childToken(childId, familyId);

      const res = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Hello! Can you teach me animal names?" })
        .expect(201);

      expect(res.body.conversationId).toBeDefined();
      expect(res.body.reply).toBe("Great job! Let's practice more.");
      expect(res.body.provider).toBe("openai");
      expect(openAiComplete).toHaveBeenCalledTimes(1);
      expect(anthropicComplete).not.toHaveBeenCalled();
    });

    it("پیام دوم در همان مکالمه ادامه می‌یابد و تاریخچه را حفظ می‌کند", async () => {
      const { childId, familyId } = await setupFamilyWithChild("T2");
      const token = childToken(childId, familyId);

      const first = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "What is a cat?" })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "What is a dog?", conversationId: first.body.conversationId })
        .expect(201);

      expect(second.body.conversationId).toBe(first.body.conversationId);
      // در دومین فراخوانی Provider، تاریخچه باید شامل هر دو پیام کاربر قبلی باشد
      const secondCallMessages = openAiComplete.mock.calls[1][0].messages;
      const userContents = secondCallMessages.filter((m) => m.role === "user").map((m) => m.content);
      expect(userContents).toEqual(["What is a cat?", "What is a dog?"]);
    });

    it("دسترسی به conversationId خانواده دیگر رد می‌شود (404، نه 403 — جلوگیری از Enumeration)", async () => {
      const familyA = await setupFamilyWithChild("T3A");
      const tokenA = childToken(familyA.childId, familyA.familyId);
      const created = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ content: "Hi there" })
        .expect(201);

      const familyB = await setupFamilyWithChild("T3B");
      const tokenB = childToken(familyB.childId, familyB.familyId);

      const res = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ content: "Hi, is this my conversation?", conversationId: created.body.conversationId });

      expect(res.status).toBe(404);
    });
  });

  describe("Safety Agent — جداسازی معماری از Tutor (SEC-040)", () => {
    it("پیامی با محتوای خودآزاری قبل از رسیدن به AI Provider رد می‌شود", async () => {
      const { childId, familyId } = await setupFamilyWithChild("T4");
      const token = childToken(childId, familyId);

      const res = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "I want to talk about self-harm" });

      expect(res.status).toBe(400);
      expect(openAiComplete).not.toHaveBeenCalled();
      expect(anthropicComplete).not.toHaveBeenCalled();
    });
  });

  describe("Fallback Orchestration واقعی — فصل ۱۳", () => {
    it("وقتی Provider اصلی (openai) خطا می‌دهد، AiProviderFactory واقعی به Provider پشتیبان (anthropic) سوییچ می‌کند", async () => {
      openAiComplete.mockRejectedValueOnce(new Error("OpenAI API error: 503"));

      const { childId, familyId } = await setupFamilyWithChild("T5");
      const token = childToken(childId, familyId);

      const res = await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Teach me colors" })
        .expect(201);

      expect(res.body.provider).toBe("anthropic");
      expect(openAiComplete).toHaveBeenCalledTimes(1);
      expect(anthropicComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("حافظه ۴‌سطحی AI — فصل ۱۴", () => {
    it("محتوای LEARNER_PROFILE در System Prompt ارسالی به Provider دیده می‌شود", async () => {
      const { childId, familyId } = await setupFamilyWithChild("T6");

      await aiMemoryRepo.save(
        aiMemoryRepo.create({
          familyId,
          childId,
          level: MemoryLevel.LEARNER_PROFILE,
          key: "learning_style",
          value: { preference: "visual-and-playful" },
        }),
      );

      const token = childToken(childId, familyId);
      await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Let's start a lesson" })
        .expect(201);

      const systemMessage = openAiComplete.mock.calls[0][0].messages.find((m) => m.role === "system");
      expect(systemMessage?.content).toContain("learning_style");
      expect(systemMessage?.content).toContain("visual-and-playful");
    });

    it("حافظه کودک یک خانواده هرگز به مکالمه کودک خانواده دیگر نشت نمی‌کند (Memory Isolation BLOCKER)", async () => {
      const familyA = await setupFamilyWithChild("T7A");
      await aiMemoryRepo.save(
        aiMemoryRepo.create({
          familyId: familyA.familyId,
          childId: familyA.childId,
          level: MemoryLevel.LEARNER_PROFILE,
          key: "private_family_a_secret_marker",
          value: { marker: "SHOULD-NEVER-LEAK" },
        }),
      );

      const familyB = await setupFamilyWithChild("T7B");
      const tokenB = childToken(familyB.childId, familyB.familyId);

      await request(app.getHttpServer())
        .post("/api/v1/ai-tutor/messages")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ content: "Let's start a lesson" })
        .expect(201);

      const systemMessage = openAiComplete.mock.calls[0][0].messages.find((m) => m.role === "system");
      expect(systemMessage?.content).not.toContain("SHOULD-NEVER-LEAK");
    });
  });
});
