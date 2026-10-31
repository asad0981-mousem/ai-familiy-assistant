import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Location } from "./entities/location.entity";
import { LocationConsent } from "./entities/location-consent.entity";
import { Device } from "../devices/entities/device.entity";
import { LocationsService } from "./locations.service";
import { LocationsController } from "./locations.controller";
import { FieldEncryptionService } from "../../common/crypto/field-encryption.service";

@Module({
  imports: [TypeOrmModule.forFeature([Location, LocationConsent, Device])],
  providers: [LocationsService, FieldEncryptionService],
  controllers: [LocationsController],
  exports: [LocationsService],
})
export class LocationsModule {}
