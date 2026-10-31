import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { Device } from "./device.entity";
import { Family } from "../../family/entities/family.entity";

/**
 * Command Matrix — طبق فصل ۳۷ Blueprint نهایی. هر نوع دستور، نیازمندی Device Owner خودش را دارد؛
 * دستورات مخرب‌تر (WIPE_DATA) فقط در Device Owner Mode مجازند و باید قبل از صف‌شدن رد شوند.
 */
export enum CommandType {
  LOCK_DEVICE = "lock_device",
  UNLOCK_DEVICE = "unlock_device",
  SET_SCREEN_TIME_LIMIT = "set_screen_time_limit",
  BLOCK_APP = "block_app",
  UNBLOCK_APP = "unblock_app",
  FORCE_LOCATION_UPDATE = "force_location_update",
  SLEEP_MODE_ENABLE = "sleep_mode_enable",
  SLEEP_MODE_DISABLE = "sleep_mode_disable",
  SYNC_POLICY = "sync_policy",
  SEND_PARENT_MESSAGE = "send_parent_message",
  REMOTE_ALARM = "remote_alarm",
  WIPE_DATA = "wipe_data", // فقط Device Owner Mode — طبق فصل ۱۱ (قانون غیرقابل‌مذاکره)
}

const DEVICE_OWNER_ONLY_COMMANDS = new Set<CommandType>([CommandType.WIPE_DATA]);

export function commandRequiresDeviceOwner(type: CommandType): boolean {
  return DEVICE_OWNER_ONLY_COMMANDS.has(type);
}

/**
 * ماشین حالت دستور — طبق فصل ۹/۱۱ Blueprint نهایی:
 * Created → Queued → Sent → Received → Executing → Executed | Failed | Expired | Cancelled
 * قانون غیرقابل‌مذاکره (فاز ۱۱): هرگز به والد "Command Executed" گفته نشود مگر پس از ACK واقعی Device Agent؛
 * رسیدن به Sent به‌تنهایی کافی برای این وضعیت نیست.
 */
export enum CommandStatus {
  CREATED = "created",
  QUEUED = "queued",
  SENT = "sent",
  RECEIVED = "received",
  EXECUTING = "executing",
  EXECUTED = "executed",
  FAILED = "failed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export const TERMINAL_COMMAND_STATUSES: ReadonlySet<CommandStatus> = new Set([
  CommandStatus.EXECUTED,
  CommandStatus.FAILED,
  CommandStatus.EXPIRED,
  CommandStatus.CANCELLED,
]);

@Entity({ name: "device_commands" })
@Index(["deviceId", "status"])
@Index(["idempotencyKey"], { unique: true })
export class DeviceCommand extends BaseEntity {
  @Column({ name: "family_id" })
  familyId!: string;

  @ManyToOne(() => Family, { onDelete: "CASCADE" })
  @JoinColumn({ name: "family_id" })
  family!: Family;

  @Column({ name: "device_id" })
  deviceId!: string;

  @ManyToOne(() => Device, { onDelete: "CASCADE" })
  @JoinColumn({ name: "device_id" })
  device!: Device;

  @Column({ name: "issued_by_user_id" })
  issuedByUserId!: string;

  @Column({ name: "type", type: "enum", enum: CommandType })
  type!: CommandType;

  @Column({ name: "payload", type: "jsonb", default: {} })
  payload!: Record<string, unknown>;

  @Column({ name: "status", type: "enum", enum: CommandStatus, default: CommandStatus.CREATED })
  status!: CommandStatus;

  /** کلید یکتا (UUIDv7 ترجیحاً) برای Idempotency در Outbox Pattern (I-C02) — جلوگیری از اجرای تکراری دستور. */
  @Column({ name: "idempotency_key", type: "uuid" })
  idempotencyKey!: string;

  /** امضای HMAC-SHA256 (یا Ed25519 در نسخه آتی) روی payload — طبق فصل ۱۶. */
  @Column({ name: "signature", type: "text" })
  signature!: string;

  @Column({ name: "queued_at", type: "timestamptz", nullable: true })
  queuedAt?: Date | null;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt?: Date | null;

  @Column({ name: "received_at", type: "timestamptz", nullable: true })
  receivedAt?: Date | null;

  @Column({ name: "executed_at", type: "timestamptz", nullable: true })
  executedAt?: Date | null;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason?: string | null;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;
}
