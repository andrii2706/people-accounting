import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AccountService } from '../../../shared/services/account.service';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { LoginComponent } from './login.component';

/** Throwaway values of a test: a fictional account and a secret of no account. */
const SETUP = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUrl: 'otpauth://totp/test',
  qr: { size: 2, cells: '1001' },
};
const PASSWORD = 'Пароль-для-тесту-1';

type State = {
  model: { set: (v: { email: string; password: string }) => void };
  step: () => string;
  error: () => string;
  code: { set: (v: string) => void };
  recovery: () => boolean;
  recoveryCodes: () => string[];
  signupEnabled: () => boolean;
  onSubmit: (e: Event) => Promise<void>;
  sendCode: () => Promise<void>;
  enable: (c: string) => Promise<void>;
  codesSaved: () => Promise<void>;
  back: (clear?: boolean) => void;
  toggleRecovery: () => void;
};

function render(auth: Record<string, unknown> = {}, enabled = true) {
  const api = {
    login: vi.fn(async () => ({ ok: true })),
    loginSetup: vi.fn(async () => SETUP),
    loginCode: vi.fn(async () => undefined),
    loginEnable: vi.fn(async () => ({ recoveryCodes: ['AAAA-BBBB'] })),
    finishSetup: vi.fn(),
    ...auth,
  };
  const account = { registerInfo: vi.fn(async () => ({ enabled })) };
  const page = renderPage<LoginComponent, State>(LoginComponent, {
    inputs: { returnUrl: '/employees' },
    auth: api,
    providers: [{ provide: AccountService, useValue: account }],
  });
  return { ...page, api };
}

const fill = (s: State) => s.model.set({ email: 'hr@example.com', password: PASSWORD });

describe('LoginComponent — вхід', () => {
  it('порожня форма — без запиту; пароль вірний — на сторінку, з якої прийшли', async () => {
    const { s, api, navigateByUrl } = render();
    await s.onSubmit(submitEvent());
    expect(api.login).not.toHaveBeenCalled();
    fill(s);
    await s.onSubmit(submitEvent());
    expect(api.login).toHaveBeenCalledWith('hr@example.com', PASSWORD);
    expect(navigateByUrl).toHaveBeenCalledWith('/employees');
    expect(s.signupEnabled()).toBe(true);
  });

  it('невірний пароль — повідомлення', async () => {
    const { s, api } = render();
    api.login.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 401, error: { message: 'Невірний email або пароль' } }),
    );
    fill(s);
    await s.onSubmit(submitEvent());
    expect(s.error()).toBe('Невірний email або пароль');
  });

  it('код із застосунку: вірний — вхід; заблоковано — назад до пароля', async () => {
    const { s, api, navigateByUrl, update } = render({
      login: vi.fn(async () => ({ twoFactor: 'CODE', ticket: 'tk' })),
    });
    fill(s);
    await s.onSubmit(submitEvent());
    expect(s.step()).toBe('code');
    update();
    await s.sendCode();
    expect(api.loginCode).not.toHaveBeenCalled();
    s.toggleRecovery();
    expect(s.recovery()).toBe(true);
    s.code.set('123 456');
    await s.sendCode();
    expect(api.loginCode).toHaveBeenCalledWith('tk', '123456');
    expect(navigateByUrl).toHaveBeenCalled();
    api.loginCode.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 401, error: { message: 'Код не підходить' } }),
    );
    s.code.set('000000');
    await s.sendCode();
    expect(s.step()).toBe('code');
    api.loginCode.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 401, error: { message: 'Вхід заблоковано на 15 хвилин' } }),
    );
    s.code.set('000000');
    await s.sendCode();
    expect(s.step()).toBe('password');
    expect(s.error()).toContain('заблоковано');
  });

  it('налаштування застосунку під час входу → резервні коди → вхід', async () => {
    const { s, api, navigateByUrl, update } = render({
      login: vi.fn(async () => ({ twoFactor: 'SETUP', ticket: 'tk' })),
    });
    await s.enable('123456');
    expect(api.loginEnable).not.toHaveBeenCalled();
    fill(s);
    await s.onSubmit(submitEvent());
    expect(s.step()).toBe('setup');
    update();
    api.loginEnable.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 400, error: { message: 'Код не підходить' } }),
    );
    await s.enable('000000');
    expect(s.error()).toBe('Код не підходить');
    await s.enable('123456');
    expect(s.step()).toBe('codes');
    update();
    await s.codesSaved();
    expect(api.finishSetup).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/employees');
    api.loginEnable.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 401, error: { message: 'Увійдіть ще раз' } }),
    );
    await s.onSubmit(submitEvent());
    s.code.set('');
    await s.enable('123456');
    expect(s.step()).toBe('password');
    s.back();
    expect(s.error()).toBe('');
  });

  it('реєстрація вимкнена або недоступна', async () => {
    const off = render({}, false);
    await Promise.resolve();
    expect(off.s.signupEnabled()).toBe(false);
    TestBed.resetTestingModule();
    const page = renderPage<LoginComponent, State>(LoginComponent, {
      providers: [
        {
          provide: AccountService,
          useValue: { registerInfo: vi.fn(async () => Promise.reject(new Error('x'))) },
        },
      ],
    });
    await Promise.resolve();
    expect(page.s.signupEnabled()).toBe(false);
  });
});

describe('LoginComponent — вхід з порталу не вдався', () => {
  it('?reason=sso&sso=keys — пояснення й посилання на портал; невідомий код — загальний текст', async () => {
    const page = renderPage<LoginComponent, State>(LoginComponent, {
      inputs: { reason: 'sso', sso: 'keys' },
      auth: { login: vi.fn() },
      providers: [
        {
          provide: AccountService,
          useValue: { registerInfo: vi.fn(async () => ({ enabled: false })) },
        },
      ],
    });
    await page.fixture.whenStable();
    const el = page.fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Не вдалося увійти з порталу');
    expect(el.textContent).toContain('не отримав ключі порталу');
    expect(el.querySelector('a[href="/"]')?.textContent).toContain('Повернутись на портал');
    page.fixture.componentRef.setInput('sso', 'щось-інше');
    page.update();
    await page.fixture.whenStable();
    expect(el.textContent).toContain('Вхід з порталу не підтверджено');
    page.fixture.componentRef.setInput('reason', 'idle');
    page.update();
    await page.fixture.whenStable();
    expect(el.textContent).not.toContain('Не вдалося увійти з порталу');
  });
});
