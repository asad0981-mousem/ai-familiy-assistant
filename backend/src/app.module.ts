import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import configuration from "./config/configuration";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AiTutorModule } from "./modules/ai-tutor/ai-tutor.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { PoliciesModule } from "./modules/policies/policies.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        host: config.get<string>("database.host"),
        port: config.get<number>("database.port"),
        username: config.get<string>("database.username"),
        password: config.get<string>("database.password"),
        database: config.get<string>("database.database"),
        ssl: config.get<boolean>("database.ssl"),
        autoLoadEntities: true,
        synchronize: false, // Migration-only — هرگز true (طبق فصل ۲۱/۳۸)
      }),
    }),
    AuthModule,
    UsersModule,
    AiTutorModule,
    DevicesModule,
    LocationsModule,
    PoliciesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
