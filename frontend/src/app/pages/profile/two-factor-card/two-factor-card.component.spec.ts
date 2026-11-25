import { TestBed } from '@angular/core/testing';
import type { MfaStatus } from '../../../shared/interfaces/auth.interface';
import { TwoFactorService } from '../../../shared/services/two-factor.service';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { TwoFactorCardComponent } from './two-factor-card.component';

const OFF: MfaStatus = { enabled: false, enabledAt: null, required: false, recoveryLeft: 0 };
const ON: MfaStatus = {
  enabled: true,
  enabledAt: '2026-11-01T10:00:00Z',
  required: false,
  recoveryLeft: 10,
};
/** A throwaway secret of a test, not of any account. */
const SETUP = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUrl: 'otpauth://totp/test',
  qr: { size: 2, cells: '1001' },
};
const CODES = ['AAAA-BBBB', 'CCCC-DDDD'];

type State = {
  status: () => MfaStatus | null;
  mode: () => string;
  setup: () => unknown;
  codes: () => string[];
  password: { set: (v: string) => void };
  code: { set: (v: string) => void };
  error: () => string;
  confirmReady: () => boolean;
  start: (m: string) => void;
  cancel: () => void;
  begin: (e: Event) => Promise<void>;
  enable: (c: string) => Promise<void>;
  confirm: (e: Event) => Promise<void>;
  codesSaved: () => void;
};

async function render(status = OFF) {
  const api = {
    status: vi.fn(async () => status),
    setup: vi.fn(async () => SETUP),
    enable: vi.fn(async () => ({ recoveryCodes: CODES, status: ON })),
    disable: vi.fn(async () => OFF),
    renewCodes: vi.fn(async () => ({ recoveryCodes: CODES, status: ON })),
  };
  const page = renderPage<TwoFactorCardComponent, State>(TwoFactorCardComponent, {
    providers: [{ provide: TwoFactorService, useValue: api }],
  });
  await Promise.resolve();
  page.update();
  return { ...page, api };
}

describe('TwoFactorCardComponent — вхід з кодом у профілі', () => {
  it('увімкнути: пароль → застосунок → резервні коди', async () => {
    const { s, api, toast, update } = await render();
    expect(s.status()).toEqual(OFF);
    s.start('password');
    await s.begin(submitEvent());
    expect(api.setup).not.toHaveBeenCalled();
    s.password.set('Пароль-для-тесту-1');
    await s.begin(submitEvent());
    expect(s.mode()).toBe('setup');
    update();
    await s.enable('123456');
    expect(s.codes()).toEqual(CODES);
    expect(s.mode()).toBe('codes');
    update();
    s.codesSaved();
    expect(toast.success).toHaveBeenCalledWith('Готово: вхід захищено кодом');
    expect(s.mode()).toBe('idle');
  });

  it('нові резервні коди і вимкнення — пароль і код', async () => {
    const { s, api, toast, update } = await render(ON);
    s.start('renew');
    update();
    await s.confirm(submitEvent());
    expect(api.renewCodes).not.toHaveBeenCalled();
    s.password.set('Пароль-для-тесту-1');
    s.code.set('123 456');
    expect(s.confirmReady()).toBe(true);
    await s.confirm(submitEvent());
    expect(api.renewCodes).toHaveBeenCalledWith('Пароль-для-тесту-1', '123456');
    expect(s.mode()).toBe('codes');
    s.start('disable');
    update();
    s.password.set('Пароль-для-тесту-1');
    s.code.set('k7qm9xda');
    await s.confirm(submitEvent());
    expect(api.disable).toHaveBeenCalledWith('Пароль-для-тесту-1', 'K7QM-9XDA');
    expect(toast.success).toHaveBeenCalledWith('Вхід з кодом вимкнено');
  });

  it('помилка — текстом; скасувати; статус не прочитано', async () => {
    const { s, api } = await render();
    api.enable.mockRejectedValueOnce(new Error('x'));
    await s.enable('000000');
    expect(s.error()).toBeTruthy();
    s.cancel();
    expect(s.mode()).toBe('idle');
    expect(s.setup()).toBeNull();
    TestBed.resetTestingModule();
    const failed = renderPage<TwoFactorCardComponent, State>(TwoFactorCardComponent, {
      providers: [
        {
          provide: TwoFactorService,
          useValue: { status: vi.fn(async () => Promise.reject(new Error('x'))) },
        },
      ],
    });
    await new Promise((r) => setTimeout(r));
    expect(failed.s.status()).toBeNull();
  });
});
