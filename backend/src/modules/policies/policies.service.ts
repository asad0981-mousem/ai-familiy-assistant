import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Policy } from "./entities/policy.entity";
import { Device } from "../devices/entities/device.entity";
import { UpdatePolicyDto } from "./dto/update-policy.dto";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { CommandSignerService } from "../../common/crypto/command-signer.service";
import { DevicesService } from "../devices/devices.service";
import { CommandType } from "../devices/entities/device-command.entity";

const DEFAULT_RULES: Record<string, unknown> = {
  screenTimeMinutesPerDay: null,
  blockedApps: [],
  sleepSchedule: null,
};

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(Policy) private readonly policies: Repository<Policy>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly signer: CommandSignerService,
    private readonly devicesService: DevicesService,
  ) {}

  /** والد — مشاهده Policy فعلی کودک (یا مقدار پیش‌فرض اگر هنوز چیزی تنظیم نشده). */
  async getCurrentForParent(requester: JwtPayload, childId: string) {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد مجاز است");
    }
    return this.findOrDefault(requester.familyId, childId);
  }

  /** Device Agent — دریافت آخرین Policy برای اعمال محلی، به‌همراه امضا جهت تایید صحت/منشاء. */
  async getCurrentForDevice(deviceToken: JwtPayload) {
    if (deviceToken.role !== "device") {
      throw new ForbiddenException("فقط Device Agent مجاز است");
    }
    const device = await this.devices.findOne({ where: { id: deviceToken.sub } });
    if (!device) {
      throw new NotFoundException("دستگاه یافت نشد");
    }
    return this.findOrDefault(device.familyId, device.childId);
  }

  /**
   * به‌روزرسانی Policy توسط والد. طبق Optimistic Locking: اگر dto.expectedVersion داده شده باشد
   * و با نسخه فعلی مطابقت نداشته باشد، 409 برمی‌گردد (کلاینت باید دوباره بخواند و merge/retry کند).
   * بعد از ذخیره موفق، یک دستور SYNC_POLICY برای تمام دستگاه‌های فعال کودک صف می‌شود تا
   * Device Agent بدون نیاز به Polling دوره‌ای طولانی، سریع از تغییر مطلع شود.
   */
  async update(requester: JwtPayload, childId: string, dto: UpdatePolicyDto) {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند Policy را تغییر دهد");
    }

    let policy = await this.policies.findOne({
      where: { familyId: requester.familyId, childId },
    });

    if (policy && dto.expectedVersion !== undefined && dto.expectedVersion !== policy.version) {
      throw new ConflictException(
        `نسخه Policy منقضی شده است (انتظار ${dto.expectedVersion}، نسخه فعلی ${policy.version}) — دوباره بخوانید و تلاش کنید`,
      );
    }

    const mergedRules = {
      ...(policy?.rules ?? DEFAULT_RULES),
      ...(dto.screenTimeMinutesPerDay !== undefined && {
        screenTimeMinutesPerDay: dto.screenTimeMinutesPerDay,
      }),
      ...(dto.blockedApps !== undefined && { blockedApps: dto.blockedApps }),
      ...(dto.sleepSchedule !== undefined && { sleepSchedule: dto.sleepSchedule }),
    };

    const nextVersion = (policy?.version ?? 0) + 1;
    const signature = this.signer.sign({ childId, version: nextVersion, rules: mergedRules });

    if (policy) {
      policy.rules = mergedRules;
      policy.version = nextVersion;
      policy.updatedByUserId = requester.sub;
      policy.signature = signature;
    } else {
      policy = this.policies.create({
        familyId: requester.familyId,
        childId,
        version: nextVersion,
        updatedByUserId: requester.sub,
        rules: mergedRules,
        signature,
      });
    }

    const saved = await this.policies.save(policy);

    await this.devicesService.enqueueCommandForChild(
      requester.familyId,
      childId,
      requester.sub,
      CommandType.SYNC_POLICY,
      { policyVersion: saved.version, reason: "policy_updated" },
    );

    return saved;
  }

  /**
   * فراخوانی‌شده توسط LocationsService بعد از لغو Consent — آیتم باز قبلی («ابلاغ خودکار لغو
   * Consent به Device Agent») دقیقاً همین‌جا بسته می‌شود: SYNC_POLICY صف می‌شود تا Device Agent
   * بلافاصله جمع‌آوری محلی موقعیت مکانی را هم متوقف کند، نه فقط رد درخواست سمت سرور.
   */
  async notifyLocationConsentRevoked(
    familyId: string,
    childId: string,
    revokedByUserId: string,
  ): Promise<void> {
    await this.devicesService.enqueueCommandForChild(
      familyId,
      childId,
      revokedByUserId,
      CommandType.SYNC_POLICY,
      { reason: "location_consent_revoked" },
    );
  }

  private async findOrDefault(familyId: string, childId: string) {
    const existing = await this.policies.findOne({ where: { familyId, childId } });
    if (existing) return existing;
    return {
      familyId,
      childId,
      version: 0,
      rules: DEFAULT_RULES,
      signature: this.signer.sign({ childId, version: 0, rules: DEFAULT_RULES }),
    };
  }
}
