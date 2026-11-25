import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ManagedUser } from '../../../shared/interfaces/auth.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UsersService } from '../../../shared/services/users.service';
import {
  authStub,
  dictionariesStub,
  internals,
  toastStub,
} from '../../../testing/fixtures.testing';
import { UsersComponent } from './users.component';

/** Fictional accounts. */
const USERS = [
  {
    id: 'u1',
    fullName: 'Кадровик Вигаданий',
    email: 'hr@example.com',
    role: 'HR',
    legalEntityId: 'le1',
    isActive: true,
    notify: true,
    modules: ['oblik'],
    mfaEnabledAt: null,
    lockedUntil: null,
  },
  {
    id: 'u2',
    fullName: 'Тестова Ольга',
    email: 'olga@example.com',
    role: 'HR',
    legalEntityId: 'le1',
    isActive: true,
    notify: true,
    modules: ['oblik', 'kadry'],
    mfaEnabledAt: '2026-01-01T00:00:00Z',
    lockedUntil: new Date(Date.now() + 600_000).toISOString(),
  },
  {
    id: 'u3',
    fullName: 'Вимкнений Обліковий',
    email: 'off@example.com',
    role: 'HR',
    legalEntityId: 'le1',
    isActive: false,
    notify: false,
    modules: ['oblik'],
    mfaEnabledAt: null,
    lockedUntil: null,
  },
] as unknown as ManagedUser[];

let users: Record<string, ReturnType<typeof vi.fn>>;
let toast: ReturnType<typeof toastStub>;
let confirm: ReturnType<typeof vi.fn>;

function render(auth = authStub()) {
  users = {
    create: vi.fn(async () => ({ id: 'u9', temporaryPasswordExpiresAt: '2026-11-27T10:00:00Z' })),
    update: vi.fn(async (id: string) => USERS.find((u) => u.id === id)),
    resetPassword: vi.fn(async () => ({
      temporaryPassword: 'Tmp-0000-x',
      mailSent: true,
      expiresAt: '2026-11-27T10:00:00Z',
    })),
    requestPasswordChange: vi.fn(async () => ({ mailSent: true, email: 'olga@example.com' })),
    resetMfa: vi.fn(async () => USERS[1]),
    unlock: vi.fn(async () => USERS[1]),
  };
  toast = toastStub();
  confirm = vi.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: DictionariesService, useValue: dictionariesStub() },
      { provide: UsersService, useValue: users },
      { provide: ToastService, useValue: toast },
      { provide: ConfirmService, useValue: { confirm } },
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(UsersComponent);
  fixture.componentRef.setInput('users', USERS);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

type State = {
  userModel: WritableSignal<Record<string, string>>;
  create: (e: Event) => Promise<void>;
  roleOptions: () => { value: string }[];
  lockedIds: () => Set<string>;
  userActions: (u: ManagedUser) => { label: string; run: () => unknown }[];
  startModules: (u: ManagedUser) => void;
  toggleEditModule: (id: string) => void;
  modulesEdit: () => { id: string; modules: string[] };
  saveModules: (u: ManagedUser) => Promise<void>;
  startEdit: (u: ManagedUser) => void;
  editModel: WritableSignal<Record<string, string>>;
  saveEdit: (e: Event, u: ManagedUser) => Promise<void>;
  toggle: (u: ManagedUser) => Promise<void>;
  requestPasswordChange: (u: ManagedUser) => Promise<void>;
  resetPassword: (u: ManagedUser) => Promise<void>;
  issuedPassword: () => { password?: string; temporaryPassword?: string } | null;
};

const ev = () => new Event('submit', { cancelable: true });

describe('UsersComponent — новий обліковий запис', () => {
  it('у формі створення немає вибору модулів; запис відкриває лише «Військовий облік»', async () => {
    const { fixture, el } = render();
    const form = el.querySelector('form') as HTMLFormElement;
    expect(form.textContent).not.toContain('Модулі');
    const s = internals<State>(fixture.componentInstance);
    s.userModel.set({
      fullName: 'Нова Людина',
      email: 'new@example.com',
      password: 'Tmp-Pass-2026-q',
      role: 'HR',
      legalEntityId: '',
    });
    await s.create(ev());
    expect(users['create']).toHaveBeenCalledWith(
      expect.objectContaining({ modules: ['oblik'], legalEntityId: null }),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Користувача створено'));
  });

  it('слабкий тимчасовий пароль — не створює', async () => {
    const { fixture } = render();
    const s = internals<State>(fixture.componentInstance);
    s.userModel.set({
      fullName: 'Нова',
      email: 'new@example.com',
      password: '123',
      role: 'HR',
      legalEntityId: '',
    });
    await s.create(ev());
    expect(users['create']).not.toHaveBeenCalled();
  });

  it('керівник юрософи видає не всі ролі; головний адміністратор — усі', () => {
    const own = internals<State>(render().fixture.componentInstance)
      .roleOptions()
      .map((o) => o.value);
    TestBed.resetTestingModule();
    const all = internals<State>(
      render(authStub({ isAdmin: () => true })).fixture.componentInstance,
    )
      .roleOptions()
      .map((o) => o.value);
    expect(all).toContain('ADMIN');
    expect(own).not.toContain('ADMIN');
  });
});

describe('UsersComponent — дії в таблиці', () => {
  it('меню рядка: заблокований вхід — «Розблокувати», з кодом — «Скинути вхід з кодом»; себе не блокує', () => {
    const s = internals<State>(render().fixture.componentInstance);
    expect(s.lockedIds().has('u2')).toBe(true);
    const labels = s.userActions(USERS[1]).map((a) => a.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Розблокувати вхід',
        'Скинути вхід з кодом',
        'Заблокувати',
        'Модулі',
      ]),
    );
    expect(s.userActions(USERS[0]).map((a) => a.label)).not.toContain('Заблокувати');
    expect(s.userActions(USERS[2]).map((a) => a.label)).toContain('Активувати');
  });

  it('модулі облікового запису в таблиці: хоча б один', async () => {
    const s = internals<State>(render().fixture.componentInstance);
    s.startModules(USERS[1]);
    s.toggleEditModule('kadry');
    expect(s.modulesEdit().modules).toEqual(['oblik']);
    await s.saveModules(USERS[1]);
    expect(users['update']).toHaveBeenCalledWith('u2', { modules: ['oblik'] });
    s.startModules(USERS[0]);
    s.toggleEditModule('oblik');
    await s.saveModules(USERS[0]);
    expect(toast.error).toHaveBeenCalledWith('Оберіть хоча б один модуль');
  });

  it('новий email — підтвердження, потім збереження', async () => {
    const s = internals<State>(render().fixture.componentInstance);
    s.startEdit(USERS[1]);
    s.editModel.update((m) => ({ ...m, email: 'olga.new@example.com' }));
    await s.saveEdit(ev(), USERS[1]);
    expect(confirm).toHaveBeenCalled();
    expect(users['update']).toHaveBeenCalledWith('u2', {
      fullName: 'Тестова Ольга',
      email: 'olga.new@example.com',
    });
    confirm.mockResolvedValueOnce(false);
    s.startEdit(USERS[1]);
    s.editModel.update((m) => ({ ...m, email: 'x@example.com' }));
    await s.saveEdit(ev(), USERS[1]);
    expect(users['update']).toHaveBeenCalledTimes(1);
  });

  it('заблокувати / активувати; лист на зміну пароля; скинути пароль — показано один раз', async () => {
    const s = internals<State>(render().fixture.componentInstance);
    await s.toggle(USERS[1]);
    expect(users['update']).toHaveBeenCalledWith('u2', { isActive: false });
    await s.toggle(USERS[2]);
    expect(users['update']).toHaveBeenCalledWith('u3', { isActive: true });
    await s.requestPasswordChange(USERS[1]);
    expect(toast.success).toHaveBeenCalledWith(
      'Лист на зміну пароля надіслано на olga@example.com',
    );
    await s.resetPassword(USERS[1]);
    expect(users['resetPassword']).toHaveBeenCalledWith('u2');
    expect(JSON.stringify(s.issuedPassword())).toContain('Tmp-0000-x');
  });
});
