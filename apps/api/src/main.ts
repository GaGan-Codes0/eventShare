import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { ENV, type Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Photo bytes never pass through the API, so request bodies stay tiny.
  app.useBodyParser('json', { limit: '100kb' });
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  const env = app.get<Env>(ENV);
  // Only the proxy on the private Docker network can reach the API, so trust its X-Forwarded-For.
  if (env.TRUST_PROXY) app.set('trust proxy', 'uniquelocal');
  await app.listen(env.PORT, '0.0.0.0');
}
await bootstrap();
