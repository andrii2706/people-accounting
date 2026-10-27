import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for state-changing requests (in addition to the SameSite=Lax cookie):
 *  • modern browsers send Sec-Fetch-Site — only same-origin is accepted;
 *  • if Origin is present it must be in APP_ORIGIN (or match the request host).
 * Requests without these headers (curl, server-to-server) are not from a browser and cannot carry a cookie attack.
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

/** API responses contain personal data — neither the browser nor proxies may cache them. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}
