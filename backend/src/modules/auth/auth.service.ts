import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { User, UserRole } from "../users/entities/user.entity";
import { Family, SubscriptionTier } from "../family/entities/family.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChildLoginDto } from "./dto/child-login.dto";
import { JwtPayload } from "./strategies/jwt.strategy";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * منطق احراز هویت والد (ثبت‌نام/ورود) و کودک (ورود با PIN — childLogin پایین‌تر).
 * ورود کودک از مسیر جداگانه (PIN، نه ایمیل/رمز عبور) است، طبق تفکیک فصل ۸/۹ Blueprint نهایی؛
 * تا همین‌جا آیتم باز مستندشده («ورود واقعی کودک») در auth.controller.ts بسته شده است.
 * PIN توسط والد از طریق PATCH /family-members/children/:childId/pin تنظیم می‌شود
 * (UsersService.setChildPin) — نه در این سرویس.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Family) private readonly families: Repository<Family>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; tokens: AuthTokens }> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("این ایمیل قبلاً ثبت شده است");
    }

    const family = this.families.create({
      name: dto.familyName,
      subscriptionTier: SubscriptionTier.FREE,
      timezone: dto.timezone || "Asia/Tehran",
      locale: "fa-IR",
    });
    await this.families.save(family);

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = this.users.create({
      family,
      familyId: family.id,
      displayName: dto.displayName,
      email: dto.email,
      passwordHash,
      role: UserRole.PARENT,
      isActive: true,
    });
    await this.users.save(user);

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("ایمیل یا رمز عبور نادرست است");
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("ایمیل یا رمز عبور نادرست است");
    }

    user.lastLoginAt = new Date();
    await this.users.save(user);

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  /**
   * ورود کودک با PIN — childId به‌تنهایی محرمانه نیست (یک UUID قابل‌مشاهده برای والد است، طبق
   * همان الگوی manual pairing code که در Device Agent Enrollment هم استفاده شده)؛ امنیت واقعی
   * از PIN (آرگون۲ هش‌شده، تایید timing-safe توسط خود argon2.verify) تامین می‌شود.
   * اگر کودک وجود نداشته باشد یا هنوز PIN تنظیم نشده باشد، همان پیام عمومی «نادرست» برگردانده
   * می‌شود (نه پیام‌های جدا) تا امکان Enumeration وجود نداشته باشد — مشابه login والد.
   */
  async childLogin(dto: ChildLoginDto): Promise<{ user: User; tokens: AuthTokens }> {
    const child = await this.users.findOne({
      where: { id: dto.childId, role: UserRole.CHILD, isActive: true },
    });
    if (!child || !child.pinHash) {
      throw new UnauthorizedException("کد ورود یا PIN نادرست است");
    }

    const valid = await argon2.verify(child.pinHash, dto.pin);
    if (!valid) {
      throw new UnauthorizedException("کد ورود یا PIN نادرست است");
    }

    child.lastLoginAt = new Date();
    await this.users.save(child);

    const tokens = await this.issueTokens(child);
    return { user: child, tokens };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    // UserRole (enum دیتابیس) و JwtRole (نوع رشته‌ای توکن، شامل "device" هم) عمداً دو نوع جدا هستند؛
    // تبدیل صریح به‌جای cast کور، تا هر عضو جدید UserRole در آینده بدون بررسی اینجا فراموش نشود.
    const role: JwtPayload["role"] = user.role === UserRole.PARENT ? "parent" : "child";
    const payload: JwtPayload = {
      sub: user.id,
      familyId: user.familyId,
      role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("jwt.accessSecret"),
      expiresIn: this.config.get<string>("jwt.accessExpiresIn"),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("jwt.refreshSecret"),
      expiresIn: this.config.get<string>("jwt.refreshExpiresIn"),
    });

    return { accessToken, refreshToken };
  }
}
