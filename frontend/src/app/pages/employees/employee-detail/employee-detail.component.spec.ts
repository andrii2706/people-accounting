import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../shared/services/employees.service';
import { LettersService } from '../../../shared/services/letters.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  authStub,
  dictionariesStub,
  employeeDetails,
  internals,
  toastStub,
} from '../../../testing/fixtures.testing';
import { EmployeeDetailComponent } from './employee-detail.component';

let toast: ReturnType<typeof toastStub>;
let letters: Record<string, ReturnType<typeof vi.fn> | ((...a: never[]) => string)>;
let employees: Record<string, ReturnType<typeof vi.fn>>;

function render(over: Partial<EmployeeDetails> = {}, auth = authStub()) {
  toast = toastStub();
  letters = {
    createChangeNotice: vi.fn(async () => ({ id: 'l1', number: 'ВО-9' })),
    noticeDocxUrl: (id: string) => `api/change-notices/${id}/docx`,
    documentUrl: (id: string) => `api/letters/${id}/docx`,
  };
  employees = {
    updateChange: vi.fn(async () => ({})),
    auditResource: vi.fn(() => ({ value: () => [], isLoading: () => false, error: () => null })),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: DictionariesService, useValue: dictionariesStub() },
      { provide: ToastService, useValue: toast },
      { provide: LettersService, useValue: letters },
      { provide: EmployeesService, useValue: employees },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EmployeeDetailComponent);
  const e = employeeDetails({
    fieldHistory: [
      {
        id: 'h1',
        field: 'phone',
        oldValue: '+380500000000',
        newValue: '+380501111111',
        effectiveDate: '2026-10-01',
        oldEffectiveDate: null,
        basis: '',
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'h2',
        field: 'tck',
        oldValue: 'Франківський РТЦК та СП',
        newValue: 'Шевченківський РТЦК та СП',
        effectiveDate: '2020-02-01',
        oldEffectiveDate: '2015-05-05',
        basis: '',
        createdAt: '2020-02-01T10:00:00Z',
      },
    ],
    changes: [
      {
        id: 'c1',
        type: 'LAST_NAME',
        typeLabel: 'Зміна прізвища',
        oldValue: 'А',
        newValue: 'Б',
        effectiveDate: '2026-11-01',
        basis: '',
        skipped: false,
        letter: null,
        deadline: '2026-11-08',
        overdue: false,
        createdAt: '',
      },
      {
        id: 'c2',
        type: 'HIRE',
        typeLabel: 'Прийняття',
        oldValue: '',
        newValue: 'Інженер',
        effectiveDate: '2020-01-01',
        basis: '',
        skipped: false,
        letter: { id: 'l0', number: '5', date: '2020-01-02', status: 'SENT' },
        deadline: '',
        overdue: false,
        createdAt: '',
      },
    ],
    derived: {
      fullName: 'Вигаданий Петро Іванович',
      warnings: [],
      listGroup: 'G2',
      rankTitle: 'солдат',
    } as never,
    ...over,
  } as Partial<EmployeeDetails>);
  fixture.componentRef.setInput('id', e.id);
  fixture.componentRef.setInput('employee', e);
  fixture.componentRef.setInput('notices', []);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController)
    .match(() => true)
    .forEach((r) => r.flush({ mobilizationUntil: '2027-02-05' }));
  fixture.detectChanges();
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

type State = {
  sections: () => {
    title: string;
    rows: {
      label: string;
      value: string;
      since?: string;
      action?: { dialog: string };
      earlier?: string[];
    }[];
  }[];
  pendingChanges: () => { id: string }[];
  contactHistory: () => unknown[];
  extractUrl: () => string | null;
  dialog: () => string | null;
  openDialog: (d: string) => void;
  createNotice: () => Promise<void>;
  skipChange: (id: string) => Promise<void>;
};

const rowOf = (s: State, label: string) =>
  s
    .sections()
    .flatMap((x) => x.rows)
    .find((r) => r.label.startsWith(label));

describe('EmployeeDetailComponent — картка працівника', () => {
  it('немає кнопки «Видалити картку»; табельний номер у шапці', () => {
    const { el } = render();
    const buttons = [...el.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');
    expect(buttons.some((t) => /Видалити картку/.test(t))).toBe(false);
    expect(el.textContent).toContain('таб. № 007');
  });

  it('ТЦК: з дати, кнопка «Змінити ТЦК», попередній ТЦК з датами', () => {
    const s = internals<State>(render().fixture.componentInstance);
    const tck = rowOf(s, 'ТЦК та СП')!;
    expect(tck.value).toBe('Шевченківський РТЦК та СП');
    expect(tck.since).toContain('01.02.2020');
    expect(tck.action?.dialog).toBe('tck');
    expect(tck.earlier?.join(' ')).toContain('Франківський РТЦК та СП');
  });

  it('звільненому змінювати контакти, паспорт і ТЦК не можна', () => {
    const s = internals<State>(render({ dismissalDate: '2026-10-01' }).fixture.componentInstance);
    expect(rowOf(s, 'ТЦК та СП')?.action).toBeUndefined();
  });

  it('черга змін для ТЦК — лише не включені до листа; історія контактів', () => {
    const s = internals<State>(render().fixture.componentInstance);
    expect(s.pendingChanges().map((c) => c.id)).toEqual(['c1']);
    expect(s.contactHistory().length).toBeGreaterThan(0);
    expect(s.extractUrl()).toContain('ids=e1');
  });

  it('діалоги контактів / паспорта / ТЦК відкриваються з картки', () => {
    const { fixture } = render();
    const s = internals<State>(fixture.componentInstance);
    s.openDialog('passport');
    fixture.detectChanges();
    expect(s.dialog()).toBe('passport');
  });

  it('лист до ТЦК: без ТЦК — підказка; з ТЦК — лист і перехід до нього', async () => {
    const noTck = render({ tckId: null, tck: null } as never);
    await internals<State>(noTck.fixture.componentInstance).createNotice();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Вкажіть ТЦК'));
    TestBed.resetTestingModule();
    const { fixture, navigate } = render();
    await internals<State>(fixture.componentInstance).createNotice();
    expect(letters['createChangeNotice']).toHaveBeenCalledWith('e1');
    expect(navigate).toHaveBeenCalledWith(['/letters', 'l1']);
  });

  it('«не повідомляти» про зміну — позначено пропущеною', async () => {
    const { fixture } = render();
    await internals<State>(fixture.componentInstance).skipChange('c1');
    expect(employees['updateChange']).toHaveBeenCalledWith('c1', { skipped: true });
  });
});
