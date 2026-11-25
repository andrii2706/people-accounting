import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { InboxItem } from '../../shared/interfaces/inbox.interface';
import type { Dashboard } from '../../shared/interfaces/report.interface';
import { DictionariesService } from '../../shared/services/dictionaries.service';
import { InboxService } from '../../shared/services/inbox.service';
import { dictionariesStub } from '../../testing/fixtures.testing';
import { renderPage } from '../../testing/page.testing';
import { DashboardComponent } from './dashboard.component';

/** Notifications about fictional people: one of each kind the overview turns into a task or a term. */
const CODES = [
  'AGE_LIMIT',
  'RESERVATION_EXPIRED',
  'RESERVATION_EXPIRING',
  'DEFERRAL_EXPIRED',
  'DEFERRAL_EXPIRING',
  'VLK_OVERDUE',
  'VLK_SOON',
];
const ITEMS: InboxItem[] = [
  {
    key: 'TCK:e1:c1',
    kind: 'TCK',
    level: 'danger',
    employeeId: 'e1',
    employeeName: 'Вигаданий Петро Іванович',
    message: '',
    link: 'NOTICES',
    read: false,
  },
  ...CODES.map(
    (code, i) =>
      ({
        key: `${code}:e${i + 2}:2026-12-0${i + 1}`,
        kind: 'CARD',
        level: i % 2 ? 'warning' : 'danger',
        employeeId: `e${i + 2}`,
        employeeName: `Тестовий${i} Іван`,
        message: '',
        link: 'EMPLOYEE',
        read: false,
      }) as InboxItem,
  ),
];
const DASHBOARD = (over: Partial<Dashboard> = {}): Dashboard =>
  ({
    date: '2026-11-24',
    employees: { employed: 10, onLists: 8, mobilized: 1, reserved: 2 },
    byGroup: {},
    bySection: { OFFICERS: 1, SOLDIERS: 5, WOMEN: 1, CONSCRIPTS: 1 },
    byCategory: {},
    deferrals: 1,
    reservation: {
      quota: 4,
      reservedCompany: 2,
      reservedOther: 0,
      available: 2,
      exceeded: false,
      entities: [{ legalEntityId: 'le1', name: 'Вигадана', quota: 4, expired: true }],
    },
    mobilizationUntil: '2027-02-05',
    pendingChanges: 1,
    overdueChanges: 1,
    attention: [{ id: 'e1', fullName: 'Вигаданий Петро', warnings: [] }],
    organizationConfigured: false,
    ...over,
  }) as unknown as Dashboard;

type State = {
  greeting: () => string;
  tasks: () => { title: string }[];
  summary: () => string;
  terms: () => unknown[];
  groups: () => { title: string; share: number }[];
  quotaShare: () => number;
  expiredQuotas: () => unknown[];
  day: (iso: string) => string;
  month: (iso: string) => string;
};

function render(dashboard: Dashboard | null, items = ITEMS, address = 'п. Петре') {
  return renderPage<DashboardComponent, State>(DashboardComponent, {
    inputs: { dashboard },
    auth: { user: () => ({ id: 'u1', role: 'HR', address }) },
    providers: [
      {
        provide: InboxService,
        useValue: {
          items: signal(items),
          loaded: signal(true),
          load: vi.fn(async () => undefined),
        },
      },
      {
        provide: DictionariesService,
        useValue: {
          ...dictionariesStub(),
          dictionaries: () => ({ listSections: [{ value: 'OFFICERS', label: 'Офіцери' }] }),
        },
      },
    ],
  });
}

describe('DashboardComponent — огляд', () => {
  it('справи на сьогодні, строки, списки, квота', () => {
    const { s, el } = render(DASHBOARD());
    expect(s.greeting()).toContain('п. Петре');
    expect(s.tasks().length).toBeGreaterThan(5);
    expect(s.summary()).toMatch(/справ.* на сьогодні, з них термінових: \d+/);
    expect(s.terms().length).toBeGreaterThan(0);
    expect(s.groups()[0]).toMatchObject({ title: 'Офіцери' });
    expect(s.groups()[1].share).toBe(100);
    expect(s.quotaShare()).toBe(50);
    expect(s.expiredQuotas()).toHaveLength(1);
    expect(s.day('2026-12-05')).toBe('05');
    expect(s.month('2026-12-05')).toBe('гру');
    expect(el.textContent).toContain('Вигаданий');
  });

  it('без звіту і справ; одна / дві справи — правильне слово', () => {
    const empty = render(null, [], '');
    expect(empty.s.groups()).toEqual([]);
    expect(empty.s.quotaShare()).toBe(0);
    expect(empty.s.summary()).toBe('0 справ на сьогодні');
    expect(empty.s.greeting()).not.toContain(',');
    TestBed.resetTestingModule();
    expect(
      render(DASHBOARD({ reservation: { quota: null } as never }), ITEMS.slice(0, 1)).s.summary(),
    ).toBe('1 справа на сьогодні, з них термінових: 1');
    TestBed.resetTestingModule();
    expect(render(DASHBOARD(), ITEMS.slice(1, 3)).s.summary()).toContain('2 справи');
  });
});
