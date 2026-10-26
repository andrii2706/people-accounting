import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createHash } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

/** Адреса NestJS API. У продакшні — URL приватного сервісу Cloud Run. */
const apiTarget = process.env['API_INTERNAL_URL'] ?? 'http://localhost:3000';
/**
 * API на Cloud Run закритий для інтернету (немає allUsers у ролі run.invoker).
 * SSR-сервер звертається до нього від імені свого сервісного акаунта: ID-токен із metadata-сервера
 * передається в X-Serverless-Authorization (Authorization не займаємо — сесія користувача живе в cookie).
 */
const useGoogleIdToken = process.env['API_AUTH'] === 'google-id-token';
/** Дозволені хости для SSR (захист від SSRF/host-header): NG_ALLOWED_HOSTS=hr.company.ua,localhost */
const allowedHosts = (process.env['NG_ALLOWED_HOSTS'] ?? 'localhost')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

/** Звідки дозволено фрейми (віджет підпису ІІТ). */
const frameSrc = (process.env['CSP_FRAME_SRC'] ?? 'https://eu.iit.com.ua')
  .split(/[ ,]+/)
  .filter(Boolean);

/**
 * Необов'язковий список дозволених мереж (офіс, VPN): ALLOWED_CLIENT_CIDRS=203.0.113.0/24,2001:db8::/48.
 * Якщо задано — з інших адрес застосунок не відкривається взагалі (403), навіть сторінка входу.
 */
const allowedNetworks = (() => {
  const raw = (process.env['ALLOWED_CLIENT_CIDRS'] ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!raw.length) return null;
  const list = new BlockList();
  for (const cidr of raw) {
    const [addr, prefix] = cidr.split('/');
    const type = isIP(addr) === 6 ? 'ipv6' : 'ipv4';
    if (prefix) list.addSubnet(addr, Number(prefix), type);
    else list.addAddress(addr, type);
  }
  return list;
})();

const app = express();
app.disable('x-powered-by');
/**
 * Скільки проксі перед цим сервером (Cloud Run / App Hosting — 1). Від цього залежить req.ip,
 * який ми передаємо в API як IP клієнта (для обмеження спроб входу та журналу).
 */
app.set('trust proxy', Number(process.env['TRUST_PROXY_HOPS'] ?? 1));
const angularApp = new AngularNodeAppEngine({ allowedHosts });

// ------------------------------------------------------------------ доступ лише з дозволених мереж
if (allowedNetworks) {
  app.use((req, res, next) => {
    const ip = (req.ip ?? '').replace(/^::ffff:/, '');
    const type = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
    if (ip && (allowedNetworks.check(ip, type) || ip === '127.0.0.1')) return next();
    res
      .status(403)
      .type('text/plain; charset=utf-8')
      .send('Доступ дозволено лише з мережі компанії.');
  });
}

// ------------------------------------------------------------------ заголовки безпеки
/**
 * Content-Security-Policy. Скрипти — лише з власного origin; інлайн-скрипти, які генерує SSR
 * (event replay тощо), дозволяються за SHA-256 хешем, обчисленим для кожної відповіді (див. нижче).
 * Ін'єкція довільного <script> чи onclick=… через XSS не виконається.
 */
const CSP_BASE = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `frame-src 'self' ${frameSrc.join(' ')}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');
const csp = (scriptHashes: string[] = []) =>
  `${CSP_BASE}; script-src 'self'${scriptHashes.map((h) => ` '${h}'`).join('')}`;

/** Хеші інлайн-скриптів у HTML (JSON-блоки на кшталт ng-state не виконуються і хешу не потребують). */
function inlineScriptHashes(html: string) {
  const hashes = new Set<string>();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = m;
    if (
      /\bsrc\s*=/i.test(attrs) ||
      /type\s*=\s*["']?application\/(ld\+)?json/i.test(attrs) ||
      !body
    )
      continue;
    hashes.add(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);
  }
  return [...hashes];
}

app.use(
  helmet({
    contentSecurityPolicy: false, // задаємо самі — з хешами інлайн-скриптів
    crossOriginEmbedderPolicy: false,
    // віджет КЕП (ІІТ) відкривається з іншого origin
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
    strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true },
  }),
);
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', csp());
  next();
});
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(self), hid=(self)',
  );
  next();
});

// ------------------------------------------------------------------ /api → NestJS
let cachedToken: { value: string; expiresAt: number } | null = null;

async function googleIdToken(audience: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const url =
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
    `?audience=${encodeURIComponent(audience)}`;
  const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!res.ok) throw new Error(`metadata server: HTTP ${res.status}`);
  const value = (await res.text()).trim();
  const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()) as {
    exp: number;
  };
  cachedToken = { value, expiresAt: payload.exp * 1000 };
  return value;
}

app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  // клієнт не може підкласти власний службовий токен
  delete req.headers['x-serverless-authorization'];
  // X-Forwarded-* формуємо самі: клієнт не повинен підмінити свій IP чи хост
  req.headers['x-forwarded-for'] = req.ip ?? '';
  req.headers['x-forwarded-host'] = req.host;
  req.headers['x-forwarded-proto'] = req.protocol;
  if (!useGoogleIdToken) return next();
  try {
    req.headers['x-serverless-authorization'] = `Bearer ${await googleIdToken(apiTarget)}`;
    next();
  } catch (err) {
    console.error('Не вдалося отримати ID-токен для API', err);
    res.status(502).json({ statusCode: 502, message: 'Сервіс тимчасово недоступний' });
  }
});

/**
 * Браузер працює з одним origin, тому httpOnly-cookie сесії не потребує CORS
 * і недоступна JavaScript-у. Host змінюємо на хост API (обов'язково для Cloud Run),
 * а Origin браузера лишається — бекенд перевіряє його (CSRF).
 */
app.use(
  '/api',
  createProxyMiddleware({
    target: `${apiTarget}/api`,
    changeOrigin: true,
    xfwd: false, // заголовки X-Forwarded-* вже виставлено вище
    proxyTimeout: 60_000,
  }),
);

// ------------------------------------------------------------------ статика і SSR
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders(res, path) {
      // файли з хешем у назві (main-ABCD1234.js) незмінні — кешуємо на рік; решту — коротко
      const hashed = /-[A-Z0-9]{8}\.(js|css|mjs)$/.test(path);
      res.setHeader(
        'Cache-Control',
        hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      );
    },
  }),
);

app.use((req, res, next) => {
  // сторінки містять персональні дані — жодного кешування проміжними проксі/CDN
  res.setHeader('Cache-Control', 'private, no-store');
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) return next();
      if (!response.headers.get('content-type')?.includes('text/html') || !response.body) {
        return writeResponseToNodeResponse(response, res);
      }
      const html = await response.text();
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', csp(inlineScriptHashes(html)));
      return writeResponseToNodeResponse(
        new Response(html, { status: response.status, statusText: response.statusText, headers }),
        res,
      );
    })
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(
      `SSR: http://localhost:${port}  ·  API → ${apiTarget}${useGoogleIdToken ? ' (IAM)' : ''}`,
    );
  });
}

export const reqHandler = createNodeRequestHandler(app);
