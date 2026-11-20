import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { AuthUser } from '../../shared/interfaces/auth.interface.js';
import type { SecurityActor, SecurityEventKind } from '../../shared/interfaces/security.interface.js';
import type { SecurityEvent } from '../entities/security-event.entity.js';
import { SECURITY_ADVICE, SECURITY_TITLES } from '../security.constants.js';

/** The client address as the proxies passed it (IPv4 without the ::ffff: prefix). */
export const clientIp = (req: Pick<Request, 'ip'>) => (req.ip ?? '').replace(/^::ffff:/, '').slice(0, 64);

/** «Chrome · Windows» — enough to recognize one's own browser in a letter. */
export function deviceLabel(userAgent = ''): string {
  const ua = userAgent;
  const browser =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\//.test(ua) && 'Opera') ||
    (/YaBrowser\//.test(ua) && 'Yandex') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    (/Chrome\//.test(ua) && 'Chrome') ||
    (/Safari\//.test(ua) && 'Safari') ||
    (/curl|wget|python|node|Go-http|okhttp|Java\//i.test(ua) && 'програма') ||
    'браузер';
  const os =
    (/Windows/.test(ua) && 'Windows') ||
    (/Android/.test(ua) && 'Android') ||
    (/iPhone|iPad|iPod/.test(ua) && 'iOS') ||
    (/Mac OS X|Macintosh/.test(ua) && 'macOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    '';
  return os ? `${browser} · ${os}` : browser;
}

/** Who did it and from where — for the journal. */
export function actorOf(req: Pick<Request, 'ip' | 'headers'>, user?: Partial<AuthUser> | null): SecurityActor {
  return {
    userId: user?.id ?? null,
    userName: user?.fullName ?? '',
    email: user?.email,
    legalEntityId: user?.legalEntityId ?? null,
    ip: clientIp(req as Request),
    userAgent: String(req.headers['user-agent'] ?? ''),
  };
}

/** The account + the random id of the device cookie → what is stored (the id itself is not). */
export const deviceHash = (userId: string, deviceId: string) =>
  createHash('sha256').update(`${userId}:${deviceId}`).digest('hex');

const DETAIL_LABELS: Record<string, string> = {
  failures: 'Невдалих спроб',
  accounts: 'Облікових записів',
  minutes: 'За хвилин',
  limit: 'Ліміт',
  period: 'Період',
  count: 'Кількість',
  file: 'Файл',
  reason: 'Причина',
  by: 'Хто',
  left: 'Залишилось кодів',
  entity: 'Юрособа',
  repeats: 'Повторів',
};

/** The letter about an event: what happened, when, from where, and what to do. */
export function securityLetter(event: SecurityEvent, appUrl: string): { subject: string; text: string } {
  const when = event.createdAt.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const title = SECURITY_TITLES[event.kind as SecurityEventKind];
  const lines = [
    title,
    '',
    `Коли: ${when}`,
    event.userName ? `Обліковий запис: ${event.userName}` : null,
    event.ip ? `Адреса: ${event.ip}` : null,
    event.device ? `Пристрій: ${event.device}` : null,
    ...Object.entries(event.details).map(([k, v]) => `${DETAIL_LABELS[k] ?? k}: ${String(v)}`),
    '',
    SECURITY_ADVICE[event.kind as SecurityEventKind] ?? null,
    '',
    `Журнал безпеки: ${appUrl.replace(/\/$/, '')}/settings/security`,
  ];
  return {
    subject: `Безпека: ${title.toLowerCase()}`,
    text: lines
      .filter((l): l is string => l !== null)
      .filter((l, i, all) => l !== '' || all[i - 1] !== '')
      .join('\n'),
  };
}
