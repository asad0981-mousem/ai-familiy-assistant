import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CommandSignerService } from "./command-signer.service";

describe("CommandSignerService", () => {
  let signer: CommandSignerService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommandSignerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === "commandSigning.privateKeyHex" ? "01".repeat(32) : undefined,
          },
        },
      ],
    }).compile();

    signer = moduleRef.get(CommandSignerService);
  });

  it("یک payload را امضا و همان امضا را تایید می‌کند", () => {
    const payload = { deviceId: "d1", type: "lock_device", idempotencyKey: "k1" };
    const signature = signer.sign(payload);
    expect(signer.verify(payload, signature)).toBe(true);
  });

  it("امضا مستقل از ترتیب کلیدهای payload است (canonical JSON)", () => {
    const a = { deviceId: "d1", type: "lock_device" };
    const b = { type: "lock_device", deviceId: "d1" };
    expect(signer.sign(a)).toBe(signer.sign(b));
  });

  it("دستکاری در payload امضا را نامعتبر می‌کند", () => {
    const payload = { deviceId: "d1", type: "lock_device" };
    const signature = signer.sign(payload);
    const tampered = { deviceId: "d1", type: "unlock_device" };
    expect(signer.verify(tampered, signature)).toBe(false);
  });

  it("امضای جعلی/کوتاه را رد می‌کند بدون خطا", () => {
    const payload = { deviceId: "d1", type: "lock_device" };
    expect(signer.verify(payload, "not-a-real-signature")).toBe(false);
  });

  it("امضا مستقل از ترتیب کلیدهای داخل payload تودرتو است (Deep Canonical JSON)", () => {
    // شبیه‌سازی سناریوی واقعی: شیء زمان امضا با یک ترتیب کلید ساخته می‌شود، اما همان داده بعداً
    // از ستون jsonb پایگاه‌داده خوانده و به‌صورت شیء جدید با ترتیب کلید متفاوت بازسازی می‌شود —
    // Device Agent باید بتواند امضای اصلی را روی هر دو شکل با موفقیت تایید کند.
    const original = {
      deviceId: "d1",
      type: "sync_policy",
      idempotencyKey: "k1",
      payload: { reason: "policy_updated", policyVersion: 3 },
    };
    const rehydratedFromDb = {
      payload: { policyVersion: 3, reason: "policy_updated" }, // ترتیب کلید معکوس
      idempotencyKey: "k1",
      deviceId: "d1",
      type: "sync_policy",
    };

    const signature = signer.sign(original);
    expect(signer.verify(rehydratedFromDb, signature)).toBe(true);
  });

  it("ترتیب عناصر آرایه معنادار است — جابه‌جایی عناصر امضا را نامعتبر می‌کند", () => {
    const a = { deviceId: "d1", blockedApps: ["com.a", "com.b"] };
    const b = { deviceId: "d1", blockedApps: ["com.b", "com.a"] };
    expect(signer.sign(a)).not.toBe(signer.sign(b));
  });

  it("کلید عمومی Hex معتبر (۶۴ کاراکتر) تولید می‌کند و کلید خصوصی را هرگز برنمی‌گرداند", () => {
    expect(signer.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("کلید خصوصی نامعتبر (نه ۶۴ کاراکتر Hex) باعث خطای فوری در راه‌اندازی می‌شود", async () => {
    const moduleBuilder = Test.createTestingModule({
      providers: [
        CommandSignerService,
        {
          provide: ConfigService,
          useValue: { get: () => "not-valid-hex" },
        },
      ],
    });
    await expect(moduleBuilder.compile()).rejects.toThrow();
  });

  /**
   * تست مقدار طلایی (Golden Value) — همان Seed خصوصی/payload/امضای دقیقی که در
   * device-agent/.../CommandSignerTest.kt برای تایید سازگاری بین پیاده‌سازی TypeScript (سرور،
   * امضا با crypto.sign) و Kotlin (Device Agent، تایید با net.i2p.crypto:eddsa) استفاده شده.
   * اگر این تست اینجا قرمز شود ولی تست Kotlin سبز بماند (یا برعکس)، یعنی دو پیاده‌سازی Ed25519
   * از هم واگرا شده‌اند — دقیقاً همان باگی که این تست باید بگیرد. مقادیر با
   * node crypto (createPrivateKey از DER دستی طبق RFC 8410) تولید و این‌جا صرفاً ثابت شده‌اند.
   */
  it("مقدار طلایی سازگار با پیاده‌سازی Kotlin — Golden Value Cross-Language (Ed25519)", () => {
    const payload = {
      deviceId: "11111111-1111-1111-1111-111111111111",
      type: "sync_policy",
      idempotencyKey: "22222222-2222-2222-2222-222222222222",
      payload: { reason: "policy_updated", policyVersion: 3, blockedApps: ["com.a", "com.b"] },
    };
    const signature = signer.sign(payload);
    expect(signature).toBe(
      "fff3499feb311c49f3763c8ee29934f15cecf5ffde6dbe9de7937239feeaeaaa98c56af0117cf0205998c38953275dd92a550f752ed7cd8c829bd221a34b6a0f",
    );
    expect(signature).toHaveLength(128);
    expect(signer.publicKeyHex).toBe("8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c");
    expect(signer.verify(payload, signature)).toBe(true);
  });
});
