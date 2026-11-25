import { PlatformLocation } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { InboxItem } from '../../shared/interfaces/inbox.interface';
import { AccountService } from '../../shared/services/account.service';
import { AuthService } from '../../shared/services/auth.service';
import { BillingService } from '../../shared/services/billing.service';
import { DictionariesService } from '../../shared/services/dictionaries.service';
import { UiIdleService } from '@mr/ui';
import { InboxService } from '../../shared/services/inbox.service';
import { authStub, dictionariesStub, internals } from '../../testing/fixtures.testing';
import { ShellComponent } from './shell.component';

let inbox: Record<string, unknown>;
let logout: ReturnType<typeof vi.fn>;

function render(baseHref = '/oblik/', auth: Record<string, unknown> = {}) {
  logout = vi.fn();
  inbox = {
    items: signal<InboxItem[]>([]),
    unread: signal<InboxItem[]>([]),
    unreadCount: signal(0),
    loaded: signal(true),
    loading: signal(false),
    refresh: vi.fn(async () => undefined),
    reset: vi.fn(),
    markRead: vi.fn(async () => undefined),
    markAllRead: vi.fn(async () => undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: authStub({
          logout,
          user: () => ({
            id: 'u1',
            fullName: 'Кадровик Вигаданий',
            role: 'HR',
            legalEntityId: 'le1',
            modules: ['oblik', 'kadry'],
          }),
          ...auth,
        }),
      },
      { provide: DictionariesService, useValue: dictionariesStub() },
      { provide: InboxService, useValue: inbox },
      { provide: BillingService, useValue: { status: vi.fn(async () => null) } },
      {
        provide: UiIdleService,
        useValue: {
          start: vi.fn(),
          stop: vi.fn(),
          touch: vi.fn(),
          ended: () => false,
          secondsLeft: () => null,
        },
      },
      { provide: AccountService, useValue: new Proxy({}, { get: () => () => false }) },
      {
        provide: PlatformLocation,
        useValue: {
          getBaseHrefFromDOM: () => baseHref,
          onPopState: () => () => undefined,
          onHashChange: () => () => undefined,
          pathname: '/',
          search: '',
          hash: '',
          href: 'http://localhost/',
          hostname: 'localhost',
          protocol: 'http:',
          port: '',
          pushState: () => undefined,
          replaceState: () => undefined,
          forward: () => undefined,
          back: () => undefined,
          historyGo: () => undefined,
          getState: () => null,
        },
      },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

type State = {
  otherApps: () => { id: string; title: string; path: string }[];
  navGroups: () => { title: string; items: { path: string }[] }[];
  inboxOpen: () => boolean;
  profileOpen: { set: (v: boolean) => void };
  paletteOpen: () => boolean;
  toggleInbox: () => void;
  closeInbox: () => void;
  onShortcut: (e: KeyboardEvent) => void;
  logout: () => void;
  openItem: (i: InboxItem) => Promise<void>;
};

const item = (over: Partial<InboxItem>): InboxItem =>
  ({ key: 'k', kind: 'TCK', link: 'NOTICES', title: 't', employeeId: 'e1', ...over }) as InboxItem;

describe('ShellComponent — оболонка «Військового обліку»', () => {
  it('за шлюзом домену (/oblik/): посилання на портал та інші модулі користувача', () => {
    const { fixture, el } = render('/oblik/');
    const apps = internals<State>(fixture.componentInstance).otherApps();
    expect(apps[0]).toEqual({ id: 'portal', title: 'Портал', path: '/' });
    expect(apps.some((a) => a.id === 'oblik')).toBe(false);
    expect(el.querySelector('nav[aria-label="Застосунки"] a[href="/"]')).not.toBeNull();
    expect(el.querySelector('a[aria-label="Повернутись на портал"]')?.getAttribute('href')).toBe(
      '/',
    );
  });

  it('застосунок сам на домені (/) — інших застосунків немає', () => {
    const { fixture, el } = render('/');
    expect(internals<State>(fixture.componentInstance).otherApps()).toEqual([]);
    expect(el.querySelector('a[aria-label="Повернутись на портал"]')).toBeNull();
  });

  it('меню: розділи роботи, звітності й довідників; без юрософи — порожнє', () => {
    expect(
      internals<State>(render().fixture.componentInstance)
        .navGroups()
        .map((g) => g.title),
    ).toEqual(['Робота', 'Звітність', 'Довідники']);
    TestBed.resetTestingModule();
    expect(
      internals<State>(
        render('/oblik/', { needsEntity: () => true }).fixture.componentInstance,
      ).navGroups(),
    ).toEqual([]);
  });

  it('сповіщення: відкрити / закрити; Ctrl K — пошук; вихід', () => {
    const { fixture } = render();
    const s = internals<State>(fixture.componentInstance);
    s.toggleInbox();
    expect(s.inboxOpen()).toBe(true);
    s.closeInbox();
    expect(s.inboxOpen()).toBe(false);
    s.onShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(s.paletteOpen()).toBe(true);
    s.logout();
    expect(logout).toHaveBeenCalled();
  });

  it('сповіщення ведуть куди треба: черга ТЦК, квота юрософи, картка працівника', async () => {
    const { fixture, navigate } = render();
    const s = internals<State>(fixture.componentInstance);
    await s.openItem(item({ link: 'NOTICES' }));
    expect(navigate).toHaveBeenLastCalledWith(['/notifications']);
    await s.openItem(item({ link: 'QUOTA', legalEntityId: 'le1' } as Partial<InboxItem>));
    expect(navigate).toHaveBeenLastCalledWith(['/settings/legal-entities', 'le1', 'quota']);
    await s.openItem(item({ link: 'CARD' as never, employeeId: 'e7' }));
    expect(navigate).toHaveBeenLastCalledWith(['/employees', 'e7']);
    expect(inbox['markRead']).toHaveBeenCalledTimes(3);
  });
});
