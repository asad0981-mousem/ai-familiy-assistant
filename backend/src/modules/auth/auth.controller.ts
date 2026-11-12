import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChildLoginDto } from "./dto/child-login.dto";

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const { user, tokens } = await this.authService.register(dto);
    return {
      user: { id: user.id, displayName: user.displayName, email: user.email, role: user.role },
      ...tokens,
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const { user, tokens } = await this.authService.login(dto);
    return {
      user: { id: user.id, displayName: user.displayName, email: user.email, role: user.role },
      ...tokens,
    };
  }

  @Post("child-login")
  @HttpCode(HttpStatus.OK)
  async childLogin(@Body() dto: ChildLoginDto) {
    const { user, tokens } = await this.authService.childLogin(dto);
    return {
      user: { id: user.id, displayName: user.displayName, role: user.role },
      ...tokens,
    };
  }
}
