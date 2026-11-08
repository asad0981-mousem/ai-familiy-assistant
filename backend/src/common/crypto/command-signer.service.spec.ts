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
              key === "commandSigning.secret" ? "test-signing-secret-at-least-32-chars" : undefined,
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

  /**
   * تست مقدار طلایی (Golden Value) — همان secret/payload/امضای دقیقی که در
   * device-agent/.../CommandSignerTest.kt برای تایید سازگاری بین پیاده‌سازی TypeScript (سرور)
   * و Kotlin (Device Agent) استفاده شده. اگر این تست اینجا قرمز شود ولی تست Kotlin سبز بماند
   * (یا برعکس)، یعنی دو پیاده‌سازی از هم واگرا شده‌اند — دقیقاً همان باگی که این تست باید بگیرد.
   */
  it("مقدار طلایی سازگار با پیاده‌سازی Kotlin — Golden Value Cross-Language", () => {
    const payload = {
      deviceId: "11111111-1111-1111-1111-111111111111",
      type: "sync_policy",
      idempotencyKey: "22222222-2222-2222-2222-222222222222",
      payload: { reason: "policy_updated", policyVersion: 3, blockedApps: ["com.a", "com.b"] },
    };
    const signature = signer.sign(payload);
    expect(signature).toBe("8a4e424de4662c65ef250842771f5be7bde259d51537339da48c81b879f39974");
    expect(signature).toHaveLength(64);
  });
});
