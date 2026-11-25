import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NOTICES_GROUPED_KEY } from '../../../shared/constants/letter.constants';
import type { PendingChange } from '../../../shared/interfaces/employee.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { LettersService } from '../../../shared/services/letters.service';
import { ToastService } from '../../../shared/services/toast.service';
import { authStub, internals, toastStub } from '../../../testing/fixtures.testing';
import { PendingChangesComponent } from './pending-changes.component';

/** A change waiting for a letter — of a fictional employee. */
function change(
  id: string,
  employeeId: string,
  tckId: string | null,
  over: Partial<PendingChange> = {},
): PendingChange {
  return {
    id,
    type: 'LAST_NAME',
    typeLabel: 'Зміна прізвища',
    oldValue: 'Старе',
    newValue: 'Нове',
    effectiveDate: '2026-11-01',
    basis: '',
    skipped: false,
    deadline: '2026-11-08',
    overdue: false,
    letter: null,
    createdAt: '2026-11-01T10:00:00Z',
    employee: {
      id: employeeId,
      fullName: `Вигаданий${employeeId} Петро Іванович`,
      tckId,
      tckName: tckId ? `ТЦК ${tckId}` : '',
      tckNameGenitive: tckId ? `ТЦК ${tckId} (род.)` : '',
      tckEmail: '',
      legalEntityId: 'le1',
      legalEntityName: 'Вигадана компанія',
    },
    ...over,
  } as PendingChange;
}

const PENDING = [
  change('c1', 'e1', 't1'),
  change('c2', 'e1', 't1', { type: 'ACTUAL_ADDRESS', typeLabel: 'Зміна адреси' }),
  change('c3', 'e2', 't1', { overdue: true }),
  change('c4', 'e3', 't2'),
  change('c5', 'e4', null),
];

let lettersService: Record<string, ReturnType<typeof vi.fn>>;
let toast: ReturnType<typeof toastStub>;

function render(pending = PENDING) {
  lettersService = {
    createChangeNotices: vi.fn(async (ids: string[]) => [
      { id: 'l1', number: 'ВО-7', employees: ids },
    ]),
    createExternalNotice: vi.fn(async () => ({ id: 'l2' })),
  };
  toast = toastStub();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub() },
      { provide: LettersService, useValue: lettersService },
      { provide: ToastService, useValue: toast },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PendingChangesComponent);
  fixture.componentRef.setInput('pending', pending);
  fixture.detectChanges();
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

type Group = { key: string; tckId: string | null; included: PendingChange[]; notices: unknown[] };
type State = {
  grouped: () => boolean;
  setGrouped: (on: boolean) => void;
  withTck: () => Group[];
  withoutTck: () => Group[];
  active: () => Group | null;
  toggleChange: (id: string, include: boolean) => void;
  createCombined: (g: Group) => Promise<void>;
  groups: () => { employeeId: string; overdue: boolean }[];
  toggle: (id: string, on: boolean) => void;
  toggleAll: (on: boolean) => void;
  selectedCount: () => number;
  selectedTckCount: () => number;
  allSelected: () => boolean;
  createForSelected: () => Promise<void>;
};

afterEach(() => localStorage.removeItem(NOTICES_GROUPED_KEY));

describe('PendingChangesComponent — об’єднаний лист до ТЦК', () => {
  it('за замовчуванням — листи за ТЦК; без ТЦК — окремо, із попередженням', () => {
    const { fixture } = render();
    const s = internals<State>(fixture.componentInstance);
    expect(s.grouped()).toBe(true);
    expect(s.withTck().map((g) => g.tckId)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(s.withoutTck()).toHaveLength(1);
    expect(s.active()?.tckId).toBeTruthy();
  });

  it('прибрана галочкою зміна не йде в лист; лист — лише з лишком', async () => {
    const { fixture, navigate } = render();
    const s = internals<State>(fixture.componentInstance);
    s.toggleChange('c2', false);
    const t1 = s.withTck().find((g) => g.tckId === 't1')!;
    expect(t1.included.map((c) => c.id).sort((a, b) => a.localeCompare(b))).toEqual(['c1', 'c3']);
    await s.createCombined(t1);
    expect(lettersService['createChangeNotices']).toHaveBeenCalledWith(['e1', 'e2'], ['c1', 'c3']);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('ВО-7'));
    expect(navigate).toHaveBeenCalledWith(['/letters', 'l1']);
    s.toggleChange('c2', true);
    expect(s.withTck().find((g) => g.tckId === 't1')!.included).toHaveLength(3);
  });

  it('перемикач запам’ятовується в цьому браузері', () => {
    const { fixture } = render();
    internals<State>(fixture.componentInstance).setGrouped(false);
    expect(localStorage.getItem(NOTICES_GROUPED_KEY)).toBe('0');
    TestBed.resetTestingModule();
    expect(internals<State>(render().fixture.componentInstance).grouped()).toBe(false);
  });

  it('помилка сервера — повідомлення, без переходу', async () => {
    const { fixture, navigate } = render();
    lettersService['createChangeNotices'].mockRejectedValueOnce(new Error('offline'));
    const s = internals<State>(fixture.componentInstance);
    await s.createCombined(s.withTck()[0]);
    expect(toast.error).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('PendingChangesComponent — по працівниках', () => {
  it('прострочені — першими; вибір і кількість листів за ТЦК', async () => {
    const { fixture, navigate } = render();
    const s = internals<State>(fixture.componentInstance);
    expect(s.groups()[0]).toMatchObject({ employeeId: 'e2', overdue: true });
    s.toggle('e1', true);
    s.toggle('e3', true);
    expect(s.selectedCount()).toBe(2);
    expect(s.selectedTckCount()).toBe(2);
    s.toggleAll(true);
    expect(s.allSelected()).toBe(true);
    s.toggleAll(false);
    s.toggle('e1', true);
    await s.createForSelected();
    expect(lettersService['createChangeNotices']).toHaveBeenCalledWith(['e1']);
    expect(navigate).toHaveBeenCalledWith(['/letters', 'l1']);
  });

  it('кілька листів — перехід до реєстру листів', async () => {
    const { fixture, navigate } = render();
    lettersService['createChangeNotices'].mockResolvedValueOnce([
      { id: 'l1', number: 'ВО-7' },
      { id: 'l2', number: 'ВО-8' },
    ]);
    const s = internals<State>(fixture.componentInstance);
    s.toggleAll(true);
    await s.createForSelected();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('ВО-7, ВО-8'));
    expect(navigate).toHaveBeenCalledWith(['/letters'], { queryParams: { type: 'CHANGE_NOTICE' } });
  });
});
