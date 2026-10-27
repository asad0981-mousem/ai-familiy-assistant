import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "../../modules/auth/strategies/jwt.strategy";

/**
 * استخراج کاربر احراز‌هویت‌شده از Request (پس از JwtAuthGuard).
 * استفاده: @CurrentUser() user: JwtPayload در هر Controller که نیاز به family_id/role دارد —
 * منبع واحد family_id برای اعمال Tenant Isolation (هرگز از body/query خام گرفته نشود).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
