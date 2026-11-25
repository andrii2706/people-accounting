import type { WritableSignal } from '@angular/core';
import type { HrBatchView, HrSyncPageData } from '../../../shared/interfaces/hr-sync.interface';
import { HrSyncService } from '../../../shared/services/hr-sync.service';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { HrSyncComponent } from './hr-sync.component';

const SETTINGS = {
  configured: true,
  system: 'ZUP',
  mode: 'PUSH',
  frequency: 'ONGOING',
  completedAt: null,
  pushWindowUntil: null,
  odataUrl: '',
  odataUser: '',
  hasOdataPassword: false,
  organizationCode: '',
  scheduleEnabled: false,
  scheduleHour: 6,
  autoApply: true,
  militaryPolicy: 'FILL_EMPTY',
  importDismissed: false,
  tokenPrefix: '',
  tokenIssuedAt: null,
  tokenExpiresAt: null,
  pushAllowedIps: '',
  lastRunAt: null,
  lastStatus: null,
  lastMessage: '',
  pushUrl: '/api/integrations/1c/employees',
  allowPrivateHosts: false,
};
const DATA = (over: Record<string, unknown> = {}) =>
  ({
    entityId: 'le1',
    entityName: 'Вигадана компанія',
    edrpou: '12345678',
    settings: { ...SETTINGS, ...over },
    history: [],
  }) as unknown as HrSyncPageData;

/** A delivery from 1C about fictional people. */
const BATCH = {
  id: 'b1',
  status: 'PENDING',
  message: 'Чекає на перегляд',
  items: [
    { action: 'UPDATE', fullName: 'Вигаданий Петро', messages: [] },
    { action: 'CREATE', fullName: 'Тестова Олена', messages: [] },
    { action: 'UNCHANGED', fullName: 'Бойко Іван', messages: [] },
  ],
} as unknown as HrBatchView;

type State = {
  model: WritableSignal<Record<string, unknown>>;
  done: () => boolean;
  tokenEndsSoon: () => boolean;
  setMode: (m: string) => void;
  setFrequency: (f: string) => void;
  setSystem: (v: string) => void;
  setPolicy: (v: string) => void;
  setHour: (v: string) => void;
  save: (e: Event) => Promise<void>;
  reopen: () => Promise<void>;
  tokenDays: WritableSignal<string>;
  issueToken: () => Promise<void>;
  issuedToken: () => string;
  revokeToken: () => Promise<void>;
  confirmRevoke: () => boolean;
  check: () => Promise<void>;
  checkResult: () => unknown;
  pull: () => Promise<void>;
  open: (id: string) => Promise<void>;
  batch: () => HrBatchView | null;
  batchItems: () => { action: string }[];
  batchActions: () => { action: string; count: number }[];
  actionFilter: WritableSignal<string>;
  apply: () => Promise<void>;
  discard: () => Promise<void>;
  remove: () => Promise<void>;
  confirmRemove: () => boolean;
  copy: (t: string, w: string) => Promise<void>;
};

function render(over: Record<string, unknown> = {}, auth: Record<string, unknown> = {}) {
  const service = {
    save: vi.fn(async () => ({})),
    reopen: vi.fn(async () => ({})),
    issueToken: vi.fn(async () => ({ token: 'mr1c_0000_secret' })),
    revokeToken: vi.fn(async () => ({})),
    check: vi.fn(async () => ({ ok: true, message: 'З’єднання є' })),
    pull: vi.fn(async () => ({ ...BATCH, message: 'Отримано' })),
    batch: vi.fn(async () => BATCH),
    apply: vi.fn(async () => ({ ...BATCH, status: 'APPLIED', message: 'Застосовано' })),
    discard: vi.fn(async () => ({ ...BATCH, status: 'DISCARDED' })),
    remove: vi.fn(async () => undefined),
  };
  const page = renderPage<HrSyncComponent, State>(HrSyncComponent, {
    inputs: { data: DATA(over) },
    providers: [{ provide: HrSyncService, useValue: service }],
    auth,
  });
  return { ...page, service };
}

describe('HrSyncComponent — інтеграція з 1С', () => {
  it('спосіб, частота, система, політика, година; збереження з підказкою «видайте ключ»', async () => {
    const { s, service, toast } = render();
    s.setMode('ODATA');
    s.setFrequency('ONCE');
    s.setSystem('BAS');
    s.setPolicy('OVERWRITE');
    s.setHour('7');
    expect(s.model()).toMatchObject({
      mode: 'ODATA',
      frequency: 'ONCE',
      system: 'BAS',
      militaryPolicy: 'OVERWRITE',
      scheduleHour: 7,
    });
    s.setMode('PUSH');
    s.model.update((m) => ({ ...m, pushAllowedIps: ' 10.0.0.1 ' }));
    await s.save(submitEvent());
    expect(service.save).toHaveBeenCalledWith(
      'le1',
      expect.objectContaining({ pushAllowedIps: '10.0.0.1' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Збережено — тепер видайте ключ для 1С');
  });

  it('OData без адреси й користувача — не зберігає; з ними — «перевірте з’єднання»', async () => {
    const { s, service, toast } = render();
    s.setMode('ODATA');
    await s.save(submitEvent());
    expect(service.save).not.toHaveBeenCalled();
    s.model.update((m) => ({
      ...m,
      odataUrl: 'https://1c.example.com/base',
      odataUser: 'u',
      odataPassword: 'p',
    }));
    await s.save(submitEvent());
    expect(toast.success).toHaveBeenCalledWith('Збережено — перевірте з’єднання');
  });

  it('кадровик бачить, але не змінює спосіб', () => {
    const { s } = render({}, { isEntityManager: () => false });
    s.setMode('ODATA');
    expect(s.model()['mode']).toBe('PUSH');
  });

  it('ключ: видати (показано раз), відкликати з підтвердженням; скоро закінчиться', async () => {
    const { s, service } = render({
      tokenPrefix: 'mr1c_0000',
      tokenExpiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });
    expect(s.tokenEndsSoon()).toBe(true);
    s.tokenDays.set('30');
    await s.issueToken();
    expect(service.issueToken).toHaveBeenCalledWith('le1', 30);
    expect(s.issuedToken()).toBe('mr1c_0000_secret');
    await s.revokeToken();
    expect(s.confirmRevoke()).toBe(true);
    expect(service.revokeToken).not.toHaveBeenCalled();
    await s.revokeToken();
    expect(service.revokeToken).toHaveBeenCalled();
    expect(s.issuedToken()).toBe('');
  });

  it('разове завантаження виконано — «Отримати ще раз»', async () => {
    const { s, service, toast } = render({
      frequency: 'ONCE',
      completedAt: '2026-11-01T10:00:00Z',
    });
    expect(s.done()).toBe(true);
    await s.reopen();
    expect(service.reopen).toHaveBeenCalledWith('le1');
    expect(toast.success).toHaveBeenCalledWith('Можна отримати дані з 1С ще раз');
  });

  it('перевірити з’єднання й отримати зараз; помилки — повідомлення', async () => {
    const { s, service, toast } = render({ mode: 'ODATA' });
    await s.check();
    expect(toast.success).toHaveBeenCalledWith('З’єднання є');
    service.check.mockResolvedValueOnce({ ok: false, message: 'Невірний пароль' });
    await s.check();
    expect(toast.error).toHaveBeenCalledWith('Невірний пароль');
    service.check.mockRejectedValueOnce(new Error('offline'));
    await s.check();
    await s.pull();
    expect(s.batch()?.id).toBe('b1');
    service.pull.mockRejectedValueOnce(new Error('offline'));
    await s.pull();
    expect(toast.error).toHaveBeenCalledTimes(3);
  });

  it('отримання: відкрити / закрити, фільтр дій, застосувати, відхилити', async () => {
    const { s, service, toast } = render();
    await s.open('b1');
    expect(s.batchActions().map((a) => a.action)).toEqual(
      expect.arrayContaining(['CREATE', 'UPDATE', 'UNCHANGED']),
    );
    s.actionFilter.set('CREATE');
    expect(s.batchItems()).toHaveLength(1);
    await s.apply();
    expect(toast.success).toHaveBeenCalledWith('Застосовано');
    service.apply.mockResolvedValueOnce({ ...BATCH, status: 'PARTIAL', message: 'Частково' });
    await s.apply();
    expect(toast.error).toHaveBeenCalledWith('Частково');
    await s.discard();
    expect(s.batch()?.status).toBe('DISCARDED');
    await s.open('b1');
    expect(s.batch()).toBeNull();
    await s.apply();
    expect(service.apply).toHaveBeenCalledTimes(2);
  });

  it('вимкнути інтеграцію — з підтвердженням; копіювати ключ', async () => {
    const { s, service, toast } = render();
    await s.remove();
    expect(s.confirmRemove()).toBe(true);
    await s.remove();
    expect(service.remove).toHaveBeenCalledWith('le1');
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    await s.copy('mr1c_x', 'Ключ');
    expect(toast.success).toHaveBeenCalledWith('Ключ скопійовано');
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) },
    });
    await s.copy('mr1c_x', 'Ключ');
    expect(toast.error).toHaveBeenCalledWith('Не вдалося скопіювати — виділіть і скопіюйте вручну');
  });

  it('помилки сервера при ключі, відкликанні, відкритті, відхиленні, вимкненні', async () => {
    const { s, service, toast } = render();
    service.issueToken.mockRejectedValueOnce(new Error('x'));
    await s.issueToken();
    service.reopen.mockRejectedValueOnce(new Error('x'));
    await s.reopen();
    service.batch.mockRejectedValueOnce(new Error('x'));
    await s.open('b9');
    await s.open('b1');
    service.discard.mockRejectedValueOnce(new Error('x'));
    await s.discard();
    service.apply.mockRejectedValueOnce(new Error('x'));
    await s.apply();
    await s.revokeToken();
    service.revokeToken.mockRejectedValueOnce(new Error('x'));
    await s.revokeToken();
    await s.remove();
    service.remove.mockRejectedValueOnce(new Error('x'));
    await s.remove();
    expect(toast.error).toHaveBeenCalledTimes(7);
  });
});
