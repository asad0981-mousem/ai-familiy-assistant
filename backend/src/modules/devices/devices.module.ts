import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Device } from "./entities/device.entity";
import { DeviceCommand } from "./entities/device-command.entity";
import { DevicesService } from "./devices.service";
import { DevicesController } from "./devices.controller";
import { CommandSignerService } from "../../common/crypto/command-signer.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, DeviceCommand]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.accessSecret"),
      }),
    }),
  ],
  providers: [DevicesService, CommandSignerService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}
