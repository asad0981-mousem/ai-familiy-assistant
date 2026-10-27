import { Column, Entity, OneToMany } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { User } from "../../users/entities/user.entity";

export enum SubscriptionTier {
  FREE = "free",
  PREMIUM = "premium",
  FAMILY = "family",
}

/**
 * Entity خانواده — ریشه Tenant Isolation (فصل ۱۵، بند IDOR/Cross-Family Authorization).
 * هر Query روی داده‌های فرزند/موقعیت/مکالمه باید از family_id این Entity عبور کند؛
 * جلوگیری از IDOR (TC-SEC-010/011 فاز ۱۰) در سطح Repository/Guard اجباری است، نه فقط UI.
 */
@Entity({ name: "families" })
export class Family extends BaseEntity {
  @Column({ name: "name", type: "varchar", length: 120 })
  name!: string;

  @Column({
    name: "subscription_tier",
    type: "enum",
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier!: SubscriptionTier;

  @Column({ name: "timezone", type: "varchar", length: 64, default: "Asia/Tehran" })
  timezone!: string;

  @Column({ name: "locale", type: "varchar", length: 10, default: "fa-IR" })
  locale!: string;

  @OneToMany(() => User, (user) => user.family)
  members!: User[];
}
