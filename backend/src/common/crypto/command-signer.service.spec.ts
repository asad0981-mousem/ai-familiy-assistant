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
          useValue: { get: () => "test-signing-secret-at-least-32-chars" },
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
});
