import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { DeviceManagementMode } from "../entities/device.entity";

export class EnrollDeviceDto {
  @IsUUID()
  childId!: string;

  @IsOptional()
  @IsEnum(DeviceManagementMode)
  managementMode?: DeviceManagementMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  osVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  agentVersion?: string;

  @IsOptional()
  @IsString()
  devicePublicKey?: string;
}
