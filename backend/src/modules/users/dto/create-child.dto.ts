import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

const ALLOWED_AGE_BANDS = ["4-6", "7-9", "10-12", "13-15", "16-17"];

export class CreateChildDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsIn(ALLOWED_AGE_BANDS, {
    message: `ageBand باید یکی از مقادیر زیر باشد: ${ALLOWED_AGE_BANDS.join(", ")}`,
  })
  ageBand!: string;
}
