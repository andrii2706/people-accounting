import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { DbExceptionFilter } from './common/db-exception.filter.js';
import { csrfGuard, noStore } from './common/security.js';
import { validationExceptionFactory } from './common/validators.js';
import { loadEnv } from './config/env.js';
import { UsersService } from './users/users.service.js';

async function bootstrap() {
  // configuration first — if something is missing, exit with a clear message
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.isProduction ? ['log', 'warn', 'error'] : undefined,
  });
  app.disable('x-powered-by');
  if (env.trustProxyHops > 0) app.set('trust proxy', env.trustProxyHops);
  app.setGlobalPrefix('api');

  app.use(helmet({ contentSecurityPolicy: env.swagger ? false : undefined, crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(cookieParser());
  app.use('/api', noStore);
  app.use('/api', csrfGuard(env.appOrigins));
  app.useBodyParser('json', { limit: '2mb' });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: validationExceptionFactory }),
  );
  app.useGlobalFilters(new DbExceptionFilter());

  // CORS only for local development; in production the frontend goes through the proxy on the same origin
  if (env.corsOrigins.length) app.enableCors({ origin: env.corsOrigins, credentials: true });

  if (env.swagger) {
    const config = new DocumentBuilder()
      .setTitle('Військовий облік — API')
      .setDescription('Облік призовників, військовозобов’язаних та резервістів на підприємстві')
      .setVersion('0.2.0')
      .addCookieAuth(env.cookieName)
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
  }

  // First administrator from the environment — so there is someone to sign in after deployment.
  if (env.adminEmail && env.adminPassword) {
    await app.get(UsersService).ensureAdmin(env.adminEmail, env.adminPassword, env.adminName);
  }

  await app.listen(env.port);
  Logger.log(`API: http://localhost:${env.port}/api${env.swagger ? `  ·  Swagger: http://localhost:${env.port}/api/docs` : ''}`, 'Bootstrap');
}
await bootstrap();
