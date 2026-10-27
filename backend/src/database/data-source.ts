import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * DataSource مستقل برای CLI (migration:generate/run/revert) — جدا از ماژول TypeOrmModule.forRootAsync
 * چون CLI به ConfigService دسترسی ندارد و مستقیماً process.env را می‌خواند.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "aifamily",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "aifamily_dev",
  ssl: process.env.DB_SSL === "true",
  entities: [__dirname + "/../**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false, // هرگز true در production — طبق فصل ۲۱ (Offline Architecture) و فصل ۳۸ (Data Retention)
  logging: process.env.NODE_ENV === "development",
};

export default new DataSource(dataSourceOptions);
