import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Environment } from './config/Environment';
import { configureApp } from './configureApp';

async function bootstrap() {
  Environment.assertInitialized();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  configureApp(app);

  await app.listen(Environment.vars.PORT);
}

void bootstrap();
