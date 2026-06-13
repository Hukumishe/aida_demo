import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { ensureUploadDir, resolveUploadDir } from './common/upload-path.util';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TimezoneInterceptor } from './common/interceptors/timezone.interceptor';
import { StripResponseMetadataInterceptor } from './common/interceptors/strip-response-metadata.interceptor';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap() {
  // Create logs directory if it doesn't exist
  const logsDir = join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const uploadDir = resolveUploadDir();
  ensureUploadDir(uploadDir);
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN');

  // CORS
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()),
      credentials: true,
    });
  } else {
    app.enableCors();
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter (with logger injection)
  const httpExceptionFilter = app.get(HttpExceptionFilter);
  app.useGlobalFilters(httpExceptionFilter);

  // Сначала приводим даты к таймзоне студии, затем убираем createdAt/updatedAt/timezone из тела ответа
  const prismaService = app.get(PrismaService);
  app.useGlobalInterceptors(
    new StripResponseMetadataInterceptor(),
    new TimezoneInterceptor(prismaService),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('AIDA Beauty Platform API')
    .setDescription('Production-ready backend for beauty studio booking platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/docs`);
}

bootstrap();




