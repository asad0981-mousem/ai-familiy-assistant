import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { Family } from "../../family/entities/family.entity";
import { User } from "../../users/entities/user.entity";

export enum DevicePlatform {
  ANDROID = "android",
}

export enum DeviceManagementMode {
  STANDARD = "standard",
  DEVICE_OWNER = "device_owner",
}

export enum DeviceStatus {
  PENDING_ENROLLMENT = "pending_enrollment",
  ACTIVE = "active",
  OFFLINE = "offline",
  REVOKED = "revoked",
}

/**
 * دستگاه کودک که Device Agent روی آن نصب است — طبق فصل ۸/۹/۱۱ Blueprint نهایی.
 * managementMode تصمیم معماری حیاتی را حمل می‌کند: Standard Mode (نصب جانبی، بدون Device Owner)
 * در برابر Device Owner Mode (DevicePolicyManager کامل، محدود به محدودیت Allowlist اندروید ۱۶ —
 * External Constraint مستندشده در فاز ۴ و تکرار در فصل ۱۱ Blueprint نهایی).
 */
@Entity({ name: "devices" })
@Index(["familyId", "childId"])
export class Device extends BaseEntity {
  @Column({ name: "family_id" })
  familyId!: string;

  @ManyToOne(() => Family, { onDelete: "CASCADE" })
  @JoinColumn({ name: "family_id" })
  family!: Family;

  @Column({ name: "child_id" })
  childId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "child_id" })
  child!: User;

  @Column({ name: "platform", type: "enum", enum: DevicePlatform, default: DevicePlatform.ANDROID })
  platform!: DevicePlatform;

  @Column({
    name: "management_mode",
    type: "enum",
    enum: DeviceManagementMode,
    default: DeviceManagementMode.STANDARD,
  })
  managementMode!: DeviceManagementMode;

  @Column({ name: "status", type: "enum", enum: DeviceStatus, default: DeviceStatus.PENDING_ENROLLMENT })
  status!: DeviceStatus;

  @Column({ name: "model", type: "varchar", length: 120, nullable: true })
  model?: string | null;

  @Column({ name: "os_version", type: "varchar", length: 40, nullable: true })
  osVersion?: string | null;

  @Column({ name: "agent_version", type: "varchar", length: 40, nullable: true })
  agentVersion?: string | null;

  /** کلید عمومی دستگاه برای تایید امضای HMAC/Ed25519 دستورات (فصل ۱۶ Security Architecture). */
  @Column({ name: "device_public_key", type: "text", nullable: true })
  devicePublicKey?: string | null;

  /** سری که با هر enrollment جدید افزایش می‌یابد — برای باطل‌کردن توکن‌های enrollment قدیمی. */
  @Column({ name: "enrollment_secret_hash", type: "varchar", length: 255, nullable: true })
  enrollmentSecretHash?: string | null;

  @Column({ name: "last_seen_at", type: "timestamptz", nullable: true })
  lastSeenAt?: Date | null;
}
