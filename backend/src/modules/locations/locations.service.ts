import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Location } from "./entities/location.entity";
import { LocationConsent } from "./entities/location-consent.entity";
import { Device } from "../devices/entities/device.entity";
import { ReportLocationDto } from "./dto/report-location.dto";
import { SetConsentDto } from "./dto/set-consent.dto";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { FieldEncryptionService } from "../../common/crypto/field-encryption.service";

export interface DecryptedLocation {
  id: string;
  deviceId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: Date;
}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(LocationConsent)
    private readonly consents: Repository<LocationConsent>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly encryption: FieldEncryptionService,
  ) {}

  /** فقط والد می‌تواند رضایت موقعیت مکانی را اعطا/لغو کند — طبق فصل ۱۰/۱۲. */
  async grantConsent(requester: JwtPayload, dto: SetConsentDto): Promise<LocationConsent> {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند رضایت موقعیت مکانی را مدیریت کند");
    }

    const existing = await this.consents.findOne({
      where: { familyId: requester.familyId, childId: dto.childId },
      order: { createdAt: "DESC" },
    });
    if (existing && existing.isActive()) {
      return existing; // Idempotent — رضایت از قبل فعال است
    }

    const consent = this.consents.create({
      familyId: requester.familyId,
      childId: dto.childId,
      grantedByUserId: requester.sub,
      grantedAt: new Date(),
    });
    return this.consents.save(consent);
  }

  async revokeConsent(requester: JwtPayload, dto: SetConsentDto): Promise<void> {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند رضایت موقعیت مکانی را مدیریت کند");
    }

    const active = await this.consents.findOne({
      where: { familyId: requester.familyId, childId: dto.childId },
      order: { createdAt: "DESC" },
    });
    if (!active || !active.isActive()) return; // Idempotent

    active.revokedAt = new Date();
    await this.consents.save(active);
    // نکته: لغو رضایت باید بلافاصله به Device Agent هم ابلاغ شود (از طریق یک Command یا Policy Sync)
    // تا جمع‌آوری محلی هم متوقف شود، نه فقط رد درخواست سمت سرور. این Orchestration در DevicesService
    // هنوز سیم‌کشی نشده — آیتم باز برای ماژول بعدی (Policy Engine).
  }

  /**
   * ثبت موقعیت مکانی توسط Device Agent. Consent Gate غیرقابل‌مذاکره (TC-LOC-019):
   * بدون رضایت فعال، حتی یک رکورد هم نباید نوشته شود.
   */
  async reportLocation(deviceToken: JwtPayload, dto: ReportLocationDto): Promise<void> {
    if (deviceToken.role !== "device") {
      throw new ForbiddenException("فقط Device Agent مجاز است");
    }

    const device = await this.devices.findOne({ where: { id: deviceToken.sub } });
    if (!device || device.familyId !== deviceToken.familyId) {
      throw new NotFoundException("دستگاه یافت نشد");
    }

    const consent = await this.consents.findOne({
      where: { familyId: device.familyId, childId: device.childId },
      order: { createdAt: "DESC" },
    });
    if (!consent || !consent.isActive()) {
      throw new ForbiddenException(
        "Consent Gate: رضایت فعال برای جمع‌آوری موقعیت مکانی این کودک وجود ندارد",
      );
    }

    const location = this.locations.create({
      familyId: device.familyId,
      childId: device.childId,
      deviceId: device.id,
      latEncrypted: this.encryption.encrypt(String(dto.lat)),
      lngEncrypted: this.encryption.encrypt(String(dto.lng)),
      accuracyMeters: dto.accuracyMeters ?? null,
      capturedAt: new Date(dto.capturedAt),
    });
    await this.locations.save(location);
  }

  /** آخرین موقعیت مکانی برای والد — با رمزگشایی. */
  async getLatest(requester: JwtPayload, childId: string): Promise<DecryptedLocation | null> {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد مجاز به مشاهده موقعیت مکانی است");
    }

    const latest = await this.locations.findOne({
      where: { familyId: requester.familyId, childId },
      order: { capturedAt: "DESC" },
    });
    if (!latest) return null;

    if (latest.familyId !== requester.familyId) {
      // دفاع دوم در برابر IDOR؛ Query بالا هم خود familyId را فیلتر می‌کند (Defense in Depth)
      throw new BadRequestException("دسترسی غیرمجاز");
    }

    return {
      id: latest.id,
      deviceId: latest.deviceId,
      lat: parseFloat(this.encryption.decrypt(latest.latEncrypted)),
      lng: parseFloat(this.encryption.decrypt(latest.lngEncrypted)),
      accuracyMeters: latest.accuracyMeters ?? null,
      capturedAt: latest.capturedAt,
    };
  }
}
