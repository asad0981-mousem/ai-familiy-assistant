import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
  sub: string; // user id
  familyId: string;
  role: "parent" | "child";
}

/**
 * استراتژی JWT برای Access Token — طبق فصل ۱۵ (Security Architecture).
 * Payload حداقلی عمداً نگه داشته شده (Data Minimization در توکن) — جزئیات کاربر از DB با sub واکشی می‌شود، نه از توکن.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.accessSecret") as string,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
