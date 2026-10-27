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
import { JwtPayload } from "./strategies/jwt.strategy";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * منطق احراز هویت والد (ثبت‌نام/ورود). ورود کودک از مسیر جداگانه (PIN/QR همراه Device Agent) است
 * و در ماژول device-agent پیاده‌سازی می‌شود، نه اینجا — طبق تفکیک فصل ۸/۹ Blueprint نهایی.
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

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      familyId: user.familyId,
      role: user.role,
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
