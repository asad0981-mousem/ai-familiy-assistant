import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import {
  Device,
  DeviceManagementMode,
  DeviceStatus,
} from "./entities/device.entity";
import {
  CommandStatus,
  CommandType,
  DeviceCommand,
  TERMINAL_COMMAND_STATUSES,
  commandRequiresDeviceOwner,
} from "./entities/device-command.entity";
import { EnrollDeviceDto } from "./dto/enroll-device.dto";
import { CreateCommandDto } from "./dto/create-command.dto";
import { AckCommandDto } from "./dto/ack-command.dto";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { CommandSignerService } from "../../common/crypto/command-signer.service";

const COMMAND_EXPIRY_MS = 24 * 60 * 60 * 1000; // ۲۴ ساعت — طبق فصل ۹ Offline Architecture

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(DeviceCommand)
    private readonly commands: Repository<DeviceCommand>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly signer: CommandSignerService,
  ) {}

  /** فقط والد می‌تواند دستگاه جدید برای فرزند خودش ثبت‌نام کند. */
  async enroll(requester: JwtPayload, dto: EnrollDeviceDto) {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند دستگاه ثبت کند");
    }

    const device = this.devices.create({
      familyId: requester.familyId,
      childId: dto.childId,
      managementMode: dto.managementMode || DeviceManagementMode.STANDARD,
      status: DeviceStatus.PENDING_ENROLLMENT,
      model: dto.model,
      osVersion: dto.osVersion,
      agentVersion: dto.agentVersion,
      devicePublicKey: dto.devicePublicKey,
    });
    await this.devices.save(device);

    // توکن دستگاه — طولانی‌مدت (Device Agent آن را در Keystore محلی ذخیره می‌کند).
    const deviceToken = await this.jwt.signAsync(
      { sub: device.id, familyId: device.familyId, role: "device" } satisfies JwtPayload,
      {
        secret: this.config.get<string>("jwt.accessSecret"),
        expiresIn: "365d",
      },
    );

    device.status = DeviceStatus.ACTIVE;
    await this.devices.save(device);

    return { device, deviceToken };
  }

  async listForFamily(requester: JwtPayload): Promise<Device[]> {
    return this.devices.find({ where: { familyId: requester.familyId } });
  }

  /**
   * ایجاد دستور توسط والد. طبق فصل ۱۶: payload امضا می‌شود تا Device Agent بتواند صحت/منشاء را تایید کند؛
   * دستورات Device-Owner-only در Standard Mode همین‌جا رد می‌شوند (Fail Closed، نه ارسال و شکست بعدی).
   */
  async createCommand(
    requester: JwtPayload,
    deviceId: string,
    dto: CreateCommandDto,
  ): Promise<DeviceCommand> {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند دستور صادر کند");
    }

    const device = await this.getOwnedDevice(requester.familyId, deviceId);

    if (
      commandRequiresDeviceOwner(dto.type) &&
      device.managementMode !== DeviceManagementMode.DEVICE_OWNER
    ) {
      throw new BadRequestException(
        `دستور ${dto.type} فقط در Device Owner Mode مجاز است (محدودیت فصل ۱۱ Blueprint نهایی)`,
      );
    }

    return this.enqueueSignedCommand(
      requester.familyId,
      deviceId,
      requester.sub,
      dto.type,
      dto.payload || {},
    );
  }

  /**
   * ایجاد دستور سیستمی (نه مستقیماً توسط والد از طریق API، بلکه توسط یک ماژول دیگر — مثلاً
   * PoliciesService یا LocationsService — در واکنش به یک رویداد) برای تمام دستگاه‌های فعال یک کودک.
   * issuedByUserId همچنان همان کاربری است که رویداد اصلی (مثلاً لغو Consent) را انجام داده —
   * برای Audit Trail صحیح، نه یک "کاربر سیستمی" گمنام.
   */
  async enqueueCommandForChild(
    familyId: string,
    childId: string,
    issuedByUserId: string,
    type: CommandType,
    payload: Record<string, unknown>,
  ): Promise<DeviceCommand[]> {
    const activeDevices = await this.devices.find({
      where: { familyId, childId, status: DeviceStatus.ACTIVE },
    });

    const results: DeviceCommand[] = [];
    for (const device of activeDevices) {
      results.push(
        await this.enqueueSignedCommand(familyId, device.id, issuedByUserId, type, payload),
      );
    }
    return results;
  }

  private async enqueueSignedCommand(
    familyId: string,
    deviceId: string,
    issuedByUserId: string,
    type: CommandType,
    payload: Record<string, unknown>,
  ): Promise<DeviceCommand> {
    const idempotencyKey = randomUUID();
    const signaturePayload = { deviceId, type, payload, idempotencyKey };

    const command = this.commands.create({
      familyId,
      deviceId,
      issuedByUserId,
      type,
      payload,
      status: CommandStatus.QUEUED,
      idempotencyKey,
      signature: this.signer.sign(signaturePayload),
      queuedAt: new Date(),
      expiresAt: new Date(Date.now() + COMMAND_EXPIRY_MS),
    });

    return this.commands.save(command);
  }

  /** Device Agent با توکن device این Endpoint را Poll می‌کند (Outbox Pull Pattern — I-C02). */
  async listPendingCommands(deviceToken: JwtPayload): Promise<DeviceCommand[]> {
    if (deviceToken.role !== "device") {
      throw new ForbiddenException("فقط Device Agent مجاز است");
    }

    const now = new Date();
    const pending = await this.commands.find({
      where: { deviceId: deviceToken.sub, status: CommandStatus.QUEUED },
      order: { createdAt: "ASC" },
    });

    const valid: DeviceCommand[] = [];
    for (const cmd of pending) {
      if (cmd.expiresAt < now) {
        cmd.status = CommandStatus.EXPIRED;
        await this.commands.save(cmd);
        continue;
      }
      cmd.status = CommandStatus.SENT;
      cmd.sentAt = now;
      valid.push(await this.commands.save(cmd));
    }

    return valid;
  }

  /**
   * گزارش وضعیت اجرای دستور از Device Agent.
   * قانون غیرقابل‌مذاکره (فاز ۱۱): وضعیت EXECUTED فقط از همین مسیر (ACK واقعی دستگاه) قابل‌ثبت است؛
   * هیچ مسیر دیگری (مثلاً فقط رسیدن به SENT) نباید این وضعیت را تولید کند.
   */
  async ackCommand(
    deviceToken: JwtPayload,
    commandId: string,
    dto: AckCommandDto,
  ): Promise<DeviceCommand> {
    if (deviceToken.role !== "device") {
      throw new ForbiddenException("فقط Device Agent مجاز است");
    }

    const command = await this.commands.findOne({ where: { id: commandId } });
    if (!command || command.deviceId !== deviceToken.sub) {
      throw new NotFoundException("دستور یافت نشد");
    }
    if (TERMINAL_COMMAND_STATUSES.has(command.status)) {
      return command; // Idempotent — ACK تکراری برای دستور تمام‌شده بی‌اثر است، نه خطا
    }

    command.status = dto.status;
    const now = new Date();
    if (dto.status === CommandStatus.RECEIVED) command.receivedAt = now;
    if (dto.status === CommandStatus.EXECUTED) command.executedAt = now;
    if (dto.status === CommandStatus.FAILED) command.failureReason = dto.failureReason || null;

    await this.devices.update(
      { id: deviceToken.sub },
      { lastSeenAt: now, status: DeviceStatus.ACTIVE },
    );

    return this.commands.save(command);
  }

  private async getOwnedDevice(familyId: string, deviceId: string): Promise<Device> {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device || device.familyId !== familyId) {
      throw new NotFoundException("دستگاه یافت نشد");
    }
    return device;
  }
}
