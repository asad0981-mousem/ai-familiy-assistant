import { IsUUID, Matches } from "class-validator";

export class ChildLoginDto {
  @IsUUID()
  childId!: string;

  @Matches(/^\d{4,6}$/, { message: "PIN باید ۴ تا ۶ رقم عددی باشد" })
  pin!: string;
}
