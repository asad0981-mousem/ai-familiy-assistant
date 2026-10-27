import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  familyName!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10, { message: "رمز عبور باید حداقل ۱۰ کاراکتر باشد" })
  password!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
