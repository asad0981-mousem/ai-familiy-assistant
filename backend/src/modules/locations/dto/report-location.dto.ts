import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsOptional, Min } from "class-validator";

export class ReportLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  @IsDateString()
  capturedAt!: string;
}
