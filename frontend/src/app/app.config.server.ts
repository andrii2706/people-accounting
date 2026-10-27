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
    // SSR requests to the API go to the internal address with the user's cookie (see SsrApiBackend)
    { provide: HttpBackend, useClass: SsrApiBackend },
    {
      provide: API_INTERNAL_URL,
      /**
       * Where SSR sends API requests. In production — our own Express proxy (SSR_API_BASE=http://127.0.0.1:8080)
       * that adds the IAM service token for the private Cloud Run; locally — straight to NestJS.
       */
      useFactory: () =>
        process.env['SSR_API_BASE'] ?? process.env['API_INTERNAL_URL'] ?? 'http://localhost:3000',
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
