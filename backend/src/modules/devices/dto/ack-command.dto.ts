import { IsEnum, IsOptional, IsString } from "class-validator";
import { CommandStatus } from "../entities/device-command.entity";

const AGENT_REPORTABLE_STATUSES = [
  CommandStatus.RECEIVED,
  CommandStatus.EXECUTING,
  CommandStatus.EXECUTED,
  CommandStatus.FAILED,
] as const;

export class AckCommandDto {
  @IsEnum(AGENT_REPORTABLE_STATUSES)
  status!: CommandStatus;

  @IsOptional()
  @IsString()
  failureReason?: string;
}
