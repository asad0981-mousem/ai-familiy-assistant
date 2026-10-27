import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole } from "./entities/user.entity";
import { CreateChildDto } from "./dto/create-child.dto";
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
}
