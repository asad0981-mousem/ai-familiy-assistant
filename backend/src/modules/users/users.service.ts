import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as argon2 from "argon2";
import { User, UserRole } from "./entities/user.entity";
import { CreateChildDto } from "./dto/create-child.dto";
import { SetChildPinDto } from "./dto/set-child-pin.dto";
import { JwtPayload } from "../auth/strategies/jwt.strategy";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** فقط والد مجاز به افزودن پروفایل کودک در خانواده خودش است — طبق فصل ۱۰ (Parent Control). */
  async createChild(requester: JwtPayload, dto: CreateChildDto): Promise<User> {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند پروفایل کودک اضافه کند");
    }

    const child = this.users.create({
      familyId: requester.familyId,
      displayName: dto.displayName,
      ageBand: dto.ageBand,
      role: UserRole.CHILD,
      isActive: true,
    });
    return this.users.save(child);
  }

  async listFamilyMembers(requester: JwtPayload): Promise<User[]> {
    return this.users.find({ where: { familyId: requester.familyId } });
  }

  /**
   * تنظیم/بازنشانی PIN ورود کودک — فقط والد همان خانواده. طبق الگوی ضدIDOR پروژه (همان‌طور که
   * در PoliciesService/LocationsService رعایت شده)، اگر childId به خانواده دیگری تعلق داشته باشد
   * ۴۰۴ برمی‌گردد نه ۴۰۳، تا از Enumeration جلوگیری شود.
   */
  async setChildPin(requester: JwtPayload, childId: string, dto: SetChildPinDto): Promise<void> {
    if (requester.role !== "parent") {
      throw new ForbiddenException("فقط والد می‌تواند PIN کودک را تنظیم کند");
    }

    const child = await this.users.findOne({
      where: { id: childId, familyId: requester.familyId, role: UserRole.CHILD },
    });
    if (!child) {
      throw new NotFoundException("کودک یافت نشد");
    }

    child.pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });
    await this.users.save(child);
  }
}
