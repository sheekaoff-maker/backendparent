import './tracing'; // must be first — see comment in tracing.ts
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const isProduction = process.env.NODE_ENV === 'production';

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Graceful shutdown: triggers PrismaService.onModuleDestroy and drains
  // in-flight work when the platform sends SIGTERM/SIGINT (Railway, PM2, k8s).
  app.enableShutdownHooks();

  // CORS: strict allowlist. Dev-only origins are never trusted in production.
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(configuredOrigins);
  if (!isProduction) {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://localhost:5173');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Requests with no Origin header (mobile apps, curl, health checks) are allowed.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      // Reject cleanly: omit CORS headers so the browser blocks it. Do NOT throw
      // — throwing turns the preflight into a 500 instead of a proper rejection.
      logger.warn(`CORS: blocked origin ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Gateway-Token'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Swagger: never exposed in production.
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Parental Control API')
      .setDescription('Smart parental control system backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  logger.log(
    `Application listening on port ${port} in ${process.env.NODE_ENV || 'development'} mode`,
  );
  if (!isProduction) {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  // Config/validation failures surface here — log and exit non-zero so the
  // orchestrator restarts (or halts a bad deploy) instead of running degraded.
  new Logger('Bootstrap').error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
