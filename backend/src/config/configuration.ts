/**
 * پیکربندی متمرکز اپلیکیشن — خوانده‌شده از متغیرهای محیطی.
 * استفاده با ConfigService (نوع‌دار) در تمام ماژول‌ها به‌جای process.env مستقیم.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  ai: {
    primaryProvider: string;
    fallbackProvider: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
  };
  location: {
    encryptionKey: string;
    rawRetentionDays: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "aifamily",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "aifamily_dev",
    ssl: process.env.DB_SSL === "true",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  ai: {
    primaryProvider: process.env.AI_PRIMARY_PROVIDER || "openai",
    fallbackProvider: process.env.AI_FALLBACK_PROVIDER || "anthropic",
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },
  location: {
    encryptionKey: process.env.LOCATION_ENCRYPTION_KEY || "",
    rawRetentionDays: parseInt(process.env.LOCATION_RAW_RETENTION_DAYS || "90", 10),
  },
});
