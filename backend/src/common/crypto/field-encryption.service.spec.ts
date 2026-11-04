import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FieldEncryptionService } from "./field-encryption.service";

describe("FieldEncryptionService", () => {
  let service: FieldEncryptionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FieldEncryptionService,
        {
          provide: ConfigService,
          useValue: { get: () => Buffer.alloc(32, "test-key").toString("base64") },
        },
      ],
    }).compile();

    service = moduleRef.get(FieldEncryptionService);
    service.onModuleInit();
  });

  it("رمزنگاری و رمزگشایی مقدار اصلی را بازمی‌گرداند", () => {
    const plaintext = "35.715298";
    const encrypted = service.encrypt(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it("هر بار رمزنگاری IV متفاوت تولید می‌کند (عدم تکرار الگو)", () => {
    const a = service.encrypt("51.404343");
    const b = service.encrypt("51.404343");
    expect(a).not.toBe(b);
  });

  it("دستکاری در داده رمزشده باعث خطای احراز (Auth Tag) می‌شود", () => {
    const encrypted = service.encrypt("35.715298");
    const [iv, tag] = encrypted.split(":");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(":");
    expect(() => service.decrypt(tampered)).toThrow();
  });
});
