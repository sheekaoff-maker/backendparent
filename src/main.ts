import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS: strict allowlist — reject unknown origins
  const corsOriginsRaw = process.env.CORS_ORIGINS || '';
  const allowedOrigins = corsOriginsRaw ? corsOriginsRaw.split(',').map((o) => o.trim()) : [];
  
  // Always allow the known frontend URLs
  allowedOrigins.push('http://localhost:3000', 'https://guardtime-web.vercel.app');

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  // Swagger: only expose in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Parental Control API')
      .setDescription('Smart parental control system backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs: http://localhost:${process.env.PORT || 3000}/api/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
}
bootstrap();
