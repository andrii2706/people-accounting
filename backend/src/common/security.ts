import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Захист від CSRF для змінюючих запитів (на додачу до SameSite=Lax cookie):
 *  • сучасні браузери надсилають Sec-Fetch-Site — приймаємо лише same-origin;
 *  • якщо є Origin — він має бути в APP_ORIGIN (або збігатися з хостом запиту).
 * Запити без цих заголовків (curl, server-to-server) не є браузерними й cookie-атаці не підлягають.
 */
export function csrfGuard(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.map((o) => o.replace(/\/$/, '')));
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') {
      return next(new ForbiddenException('Запит з іншого сайту заблоковано'));
    }

    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers['x-forwarded-host'] ?? req.headers.host;
      const sameHost = !!host && (origin === `https://${host}` || origin === `http://${host}`);
      if (!sameHost && !allowed.has(origin)) return next(new ForbiddenException('Недозволене джерело запиту'));
    }
    next();
  };
}

/** Відповіді API містять персональні дані — їх не можна кешувати ні браузеру, ні проксі. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}
