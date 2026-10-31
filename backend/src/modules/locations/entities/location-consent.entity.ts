import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";

/**
 * Consent Gate — طبق BLOCKER غیرقابل‌مذاکره TC-LOC-019 (فاز ۱۰): هیچ موقعیت مکانی‌ای نباید
 * بدون رضایت صریح و فعال ثبت شود. هر خانواده/کودک حداکثر یک رکورد Consent فعال دارد؛
 * لغو رضایت (revokedAt) باید بلافاصله جمع‌آوری موقعیت بعدی را مسدود کند — بدون استثنا، حتی برای
 * Device Owner Mode (شفافیت ضد Stalkerware، اصل بنیادین فصل ۱۰).
 */
@Entity({ name: "location_consents" })
@Index(["familyId", "childId"])
export class LocationConsent extends BaseEntity {
  @Column({ name: "family_id" })
  familyId!: string;

  @Column({ name: "child_id" })
  childId!: string;

  @Column({ name: "granted_by_user_id" })
  grantedByUserId!: string;

  @Column({ name: "granted_at", type: "timestamptz" })
  grantedAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt?: Date | null;

  isActive(): boolean {
    return !this.revokedAt;
  }
}
