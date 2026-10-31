import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";

/**
 * یک رکورد موقعیت مکانی خام — طبق فصل ۱۲ (Location Architecture).
 * latEncrypted/lngEncrypted با AES-256-GCM سطح فیلد رمزنگاری می‌شوند (FieldEncryptionService)؛
 * هرگز مختصات خام مستقیماً در ستون ذخیره نمی‌شود.
 *
 * سیاست نگهداری (فصل ۳۸، Data Retention Matrix): رکوردهای خام حداکثر ۹۰ روز نگه داشته می‌شوند
 * و باید توسط یک Job زمان‌بندی‌شده (در infra واقعی) پاکسازی شوند — این Job هنوز در این Sandbox
 * پیاده‌سازی/زمان‌بندی نشده (نیاز به زیرساخت Scheduler/Queue که خارج از scope همین Commit است).
 */
@Entity({ name: "locations" })
@Index(["familyId", "childId", "capturedAt"])
export class Location extends BaseEntity {
  @Column({ name: "family_id" })
  familyId!: string;

  @Column({ name: "child_id" })
  childId!: string;

  @Column({ name: "device_id" })
  deviceId!: string;

  @Column({ name: "lat_encrypted", type: "text" })
  latEncrypted!: string;

  @Column({ name: "lng_encrypted", type: "text" })
  lngEncrypted!: string;

  @Column({ name: "accuracy_meters", type: "real", nullable: true })
  accuracyMeters?: number | null;

  @Column({ name: "captured_at", type: "timestamptz" })
  capturedAt!: Date;
}
