import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Policy } from "./entities/policy.entity";
import { Device } from "../devices/entities/device.entity";
import { PoliciesService } from "./policies.service";
import { PoliciesController } from "./policies.controller";
import { CommandSignerService } from "../../common/crypto/command-signer.service";
import { DevicesModule } from "../devices/devices.module";

@Module({
  imports: [TypeOrmModule.forFeature([Policy, Device]), DevicesModule],
  providers: [PoliciesService, CommandSignerService],
  controllers: [PoliciesController],
  exports: [PoliciesService],
})
export class PoliciesModule {}
