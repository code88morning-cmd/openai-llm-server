import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`LLM server is running on http://localhost:${port}`);
}

void bootstrap();
