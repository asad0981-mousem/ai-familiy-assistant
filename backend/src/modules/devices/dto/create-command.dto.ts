import { IsEnum, IsObject, IsOptional } from "class-validator";
import { CommandType } from "../entities/device-command.entity";

export class CreateCommandDto {
  @IsEnum(CommandType)
  type!: CommandType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
