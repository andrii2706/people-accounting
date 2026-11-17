import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { Organization } from '../organization/organization.entity.js';
import { DailyJobService } from './daily-job.service.js';
import type { NotificationsService } from './notifications.service.js';

// loadEnv() runs in the constructor: a minimal development configuration (no real secrets)
process.env['DATABASE_URL'] ??= 'postgres://test:test@localhost/test';
process.env['JWT_SECRET'] ??= 'test-only-secret-0123456789abcdef-0123';

const LIST = `<h3><a href="/documents/10612026-62225">УКАЗ ПРЕЗИДЕНТА УКРАЇНИ №1061/2026</a></h3>
  <p>26 жовтня 2026 року</p><p>Про продовження строку проведення загальної мобілізації</p>`;
const DECREE = '<p>продовжити з 31 жовтня 2026 року строк проведення загальної мобілізації на 90 діб.</p>';

function service() {
  const saved: Partial<Organization>[] = [];
  const org = {
    id: 1,
    mobilizationUntil: null,
    mobilizationConfirmedUntil: null,
    mobilizationDecree: '',
    mobilizationEstimated: false,
  };
  const orgRepo = {
    findOneBy: async () => org,
    create: () => org,
    save: async (o: Partial<Organization>) => saved.push({ ...o }),
  } as unknown as Repository<Organization>;
  const notified: string[] = [];
  const notifications = {
    notifyUsers: async (subject: string) => notified.push(subject),
  } as unknown as NotificationsService;
  const job = new DailyJobService({} as never, orgRepo, notifications, {} as never, {} as never, {} as never);
  return { job, saved, notified };
}

const connectTimeout = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });

describe('строк мобілізації, коли zakon.rada.gov.ua недоступний', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('бере строк з указу на president.gov.ua', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('zakon.rada.gov.ua')) throw connectTimeout();
      if (url.includes('/documents/decrees')) return new Response(LIST);
      if (url.endsWith('/documents/10612026-62225')) return new Response(DECREE);
      return new Response('', { status: 404 });
    });
    const { job, saved, notified } = service();
    const result = await job.updateMobilization('2026-11-17');
    expect(result).toMatchObject({
      ok: true,
      until: '2027-01-29',
      decree: 'Указ Президента України № 1061/2026 від 26.10.2026',
      changed: true,
    });
    expect(saved.at(-1)).toMatchObject({
      mobilizationUntil: '2027-01-29',
      mobilizationSource: 'https://www.president.gov.ua/documents/10612026-62225',
    });
    expect(notified).toEqual(['Мобілізацію продовжено до 29.01.2027']);
  });

  it('обидва сайти недоступні — зрозуміла помилка, як раніше', async () => {
    vi.stubGlobal('fetch', async () => {
      throw connectTimeout();
    });
    const result = await service().job.updateMobilization('2026-11-17');
    expect(result).toMatchObject({ ok: false, until: null });
    expect(result.ok === false && result.message).toContain('UND_ERR_CONNECT_TIMEOUT');
  });
});
