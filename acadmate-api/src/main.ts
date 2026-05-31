import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error']
      : ['log', 'warn', 'error', 'debug'],
  });
  app.use(json({ limit: '50mb' }));
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());

  const originsEnv = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const allowedOrigins = originsEnv.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // ─── Global pipes, filters & interceptors ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ─── Swagger docs (dev only) ──────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Acadmate API')
      .setDescription('NestJS backend for the Acadmate CBT Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ─── Start ────────────────────────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`Acadmate API running on port ${port}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
