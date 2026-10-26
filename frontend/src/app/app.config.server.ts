import { HttpBackend } from '@angular/common/http';
import { type ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SsrApiBackend } from './shared/backends/ssr-api.backend';
import { API_INTERNAL_URL } from './shared/tokens/api.tokens';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // запити SSR до API — через внутрішню адресу з cookie користувача (див. SsrApiBackend)
    { provide: HttpBackend, useClass: SsrApiBackend },
    {
      provide: API_INTERNAL_URL,
      /**
       * Куди SSR надсилає запити до API. У продакшні — власний Express-проксі (SSR_API_BASE=http://127.0.0.1:8080),
       * який додає службовий IAM-токен для приватного Cloud Run; локально — напряму в NestJS.
       */
      useFactory: () =>
        process.env['SSR_API_BASE'] ?? process.env['API_INTERNAL_URL'] ?? 'http://localhost:3000',
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
