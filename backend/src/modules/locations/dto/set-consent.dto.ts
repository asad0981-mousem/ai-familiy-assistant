import { IsUUID } from "class-validator";

export class SetConsentDto {
  @IsUUID()
  childId!: string;
}
