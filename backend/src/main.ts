import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

/**
 * نقطه ورود بک‌اند AI Family Assistant.
 * طبق فصل ۱۵ (Security Architecture) و فصل ۲۰ (Backend Architecture) سند نهایی:
 * - Helmet برای هدرهای امنیتی پایه
 * - ValidationPipe سراسری با whitelist (رد فیلدهای ناشناخته در DTO)
 * - Versioning روی مسیر API: /api/v1/...
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.use(helmet());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AI Family Assistant backend listening on port ${port}`);
}

bootstrap();
