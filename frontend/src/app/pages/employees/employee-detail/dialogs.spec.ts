import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../shared/services/employees.service';
import { ToastService } from '../../../shared/services/toast.service';
import { todayIso } from '../../../shared/utils/date.utils';
import {
  authStub,
  dictionariesStub,
  employeeDetails,
  internals,
  toastStub,
} from '../../../testing/fixtures.testing';
import { ContactsDialogComponent } from './contacts-dialog/contacts-dialog.component';
import { PassportDialogComponent } from './passport-dialog/passport-dialog.component';
import { TckDialogComponent } from './tck-dialog/tck-dialog.component';

let update: ReturnType<typeof vi.fn>;
let toast: ReturnType<typeof toastStub>;
let dict: ReturnType<typeof dictionariesStub>;

beforeEach(() => {
  update = vi.fn(async () => ({}));
  toast = toastStub();
  dict = dictionariesStub();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: EmployeesService, useValue: { update } },
      { provide: ToastService, useValue: toast },
      { provide: DictionariesService, useValue: dict },
      { provide: AuthService, useValue: authStub() },
    ],
  });
});

/** Opens a dialog for the fictional employee; `model` — the form state its template edits. */
function open<C>(type: Type<C>, over = {}) {
  const fixture = TestBed.createComponent(type);
  fixture.componentRef.setInput('employee', employeeDetails(over));
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  const saved = vi.fn();
  (fixture.componentInstance as { saved: { subscribe: (f: () => void) => void } }).saved.subscribe(
    saved,
  );
  return { fixture, saved, el: fixture.nativeElement as HTMLElement };
}

const submitEvent = () => new Event('submit', { cancelable: true });

describe('ContactsDialogComponent — контакти й адреси з датою', () => {
  type State = {
    model: WritableSignal<Record<string, unknown>>;
    changes: () => Record<string, boolean>;
    save: (e: Event) => Promise<void>;
  };

  it('відкривається з даними картки: фактичної немає — «збігається із зареєстрованим»', () => {
    const { fixture, el } = open(ContactsDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    expect(s.model()).toMatchObject({
      phone: '+380501111111',
      sameAsRegistered: true,
      effectiveDate: todayIso(),
    });
    expect(el.textContent).toContain('Зараз: +380501111111');
    expect(el.textContent).toContain('буде зареєстроване місце проживання');
  });

  it('без змін — «Нічого не змінено», запиту немає', async () => {
    const { fixture } = open(ContactsDialogComponent);
    await internals<State>(fixture.componentInstance).save(submitEvent());
    expect(toast.info).toHaveBeenCalledWith('Нічого не змінено');
    expect(update).not.toHaveBeenCalled();
  });

  it('новий телефон і фактична адреса: лише змінені поля, дата й підстава', async () => {
    const { fixture, saved } = open(ContactsDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    s.model.update((m) => ({
      ...m,
      phone: '+380502222222',
      sameAsRegistered: false,
      actualAddress: ' м. Тестове, вул. Нова, 2 ',
      effectiveDate: '2026-11-01',
      basis: ' заява ',
    }));
    await s.save(submitEvent());
    expect(update).toHaveBeenCalledWith('e1', {
      phone: '+380502222222',
      actualAddress: 'м. Тестове, вул. Нова, 2',
      changeMeta: { effectiveDate: '2026-11-01', basis: 'заява' },
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('повідомлення ТЦК'));
    expect(saved).toHaveBeenCalled();
  });

  it('майбутня дата чи хибний email — не зберігає', async () => {
    const { fixture } = open(ContactsDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    s.model.update((m) => ({ ...m, email: 'не-email', effectiveDate: '2999-01-01' }));
    await s.save(submitEvent());
    expect(update).not.toHaveBeenCalled();
  });

  it('помилка сервера — повідомлення, без закриття', async () => {
    update.mockRejectedValueOnce(new Error('offline'));
    const { fixture, saved } = open(ContactsDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    s.model.update((m) => ({ ...m, phone: '+380503333333' }));
    await s.save(submitEvent());
    expect(saved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('PassportDialogComponent — новий паспорт → повідомлення ТЦК', () => {
  type State = {
    model: WritableSignal<Record<string, unknown>>;
    current: () => string;
    draft: () => { tckName: string; notices: number } | null;
    setType: (t: 'ID_CARD' | 'BOOK') => void;
    save: (e: Event) => Promise<void>;
  };

  it('показує чинний паспорт і чернетку листа до ТЦК працівника', async () => {
    const { fixture } = open(PassportDialogComponent);
    const backend = TestBed.inject(HttpTestingController);
    backend.expectOne('api/employees/changes/pending').flush([
      { id: 'c1', employee: { id: 'e2', tckId: 't1', legalEntityId: 'le1', tckName: 'x' } },
      { id: 'c2', employee: { id: 'e3', tckId: 't2', legalEntityId: 'le1', tckName: 'y' } },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    const s = internals<State>(fixture.componentInstance);
    expect(s.current()).toBe('ID-картка · № 000000001 · 01.01.2016 · 0000');
    expect(s.draft()).toMatchObject({ tckName: 'Шевченківського РТЦК та СП', notices: 1 });
  });

  it('дата зміни підставляється з дати видачі; ID-картка без серії; повідомлення за замовчуванням', async () => {
    const { fixture, saved } = open(PassportDialogComponent);
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((r) => r.flush([]));
    const s = internals<State>(fixture.componentInstance);
    s.model.update((m) => ({
      ...m,
      passportNumber: '000000002',
      passportIssuedBy: '1234',
      passportIssuedAt: '2026-11-01',
    }));
    fixture.detectChanges();
    expect(s.model()['effectiveDate']).toBe('2026-11-01');
    await s.save(submitEvent());
    expect(update).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({
        passportType: 'ID_CARD',
        passportSeries: '',
        passportNumber: '000000002',
        changeMeta: { effectiveDate: '2026-11-01', basis: 'ID-картка № 000000002', notify: true },
      }),
    );
    expect(saved).toHaveBeenCalled();
  });

  it('книжечка: серія великими; «не повідомляти»; хибний номер — не зберігає', async () => {
    const { fixture } = open(PassportDialogComponent);
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((r) => r.flush([]));
    const s = internals<State>(fixture.componentInstance);
    s.setType('BOOK');
    s.model.update((m) => ({
      ...m,
      passportSeries: 'аа',
      passportNumber: '12',
      passportIssuedBy: 'РВ',
      passportIssuedAt: '2010-01-01',
    }));
    fixture.detectChanges();
    await s.save(submitEvent());
    expect(update).not.toHaveBeenCalled();
    s.model.update((m) => ({
      ...m,
      passportSeries: 'АА',
      passportNumber: '123456',
      notify: false,
    }));
    await s.save(submitEvent());
    expect(update.mock.calls[0][1]).toMatchObject({
      passportSeries: 'АА',
      changeMeta: { notify: false },
    });
    expect(toast.success).toHaveBeenCalledWith('Паспорт змінено');
  });
});

describe('TckDialogComponent — ТЦК з дати', () => {
  type State = {
    model: WritableSignal<Record<string, string>>;
    tckOptions: () => { value: string }[];
    chosenAddress: () => string;
    current: () => string;
    adding: () => boolean;
    added: () => string | null;
    openAdding: () => void;
    tckModel: WritableSignal<Record<string, string>>;
    addTck: (e: Event) => Promise<void>;
    save: (e: Event) => Promise<void>;
  };

  it('поточний ТЦК з датою; у виборі — інші ТЦК; підстава — з найновішого документа', () => {
    const { fixture } = open(TckDialogComponent, {
      militaryDocuments: [
        { type: 'Військовий квиток', issuedAt: '2010-01-01' },
        { type: 'Тимчасове посвідчення', issuedAt: '2024-05-06' },
      ],
    });
    const s = internals<State>(fixture.componentInstance);
    expect(s.current()).toBe('Шевченківський РТЦК та СП з 01.02.2020');
    expect(s.tckOptions().map((o) => o.value)).toEqual(['t2']);
    expect(s.model()['basis']).toBe('Тимчасове посвідчення від 06.05.2024');
  });

  it('обрано ТЦК і дату — зміна з датою обліку', async () => {
    const { fixture, saved } = open(TckDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    s.model.set({ tckId: 't2', tckRegisteredAt: '2026-11-10', basis: '' });
    expect(s.chosenAddress()).toBe('');
    await s.save(submitEvent());
    expect(update).toHaveBeenCalledWith('e1', {
      tckId: 't2',
      tckRegisteredAt: '2026-11-10',
      changeMeta: { effectiveDate: '2026-11-10', basis: undefined },
    });
    expect(saved).toHaveBeenCalled();
  });

  it('без ТЦК чи дати — не зберігає', async () => {
    const { fixture } = open(TckDialogComponent);
    await internals<State>(fixture.componentInstance).save(submitEvent());
    expect(update).not.toHaveBeenCalled();
  });

  it('нового ТЦК немає в довіднику — додати тут і одразу обрати', async () => {
    const { fixture } = open(TckDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    s.openAdding();
    expect(s.adding()).toBe(true);
    s.tckModel.update((m) => ({ ...m, name: ' Новий РТЦК та СП ', postalCode: '01004' }));
    await s.addTck(submitEvent());
    expect(dict.saveTck).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Новий РТЦК та СП', isActive: true }),
    );
    expect(dict.reloadTcks).toHaveBeenCalled();
    expect(s.model()['tckId']).toBe('t-new');
    expect(s.added()).toBe('t-new');
    expect(s.adding()).toBe(false);
  });

  it('новий ТЦК без назви чи з хибним індексом — не додається', async () => {
    const { fixture } = open(TckDialogComponent);
    const s = internals<State>(fixture.componentInstance);
    s.openAdding();
    s.tckModel.update((m) => ({ ...m, name: '', postalCode: '1' }));
    await s.addTck(submitEvent());
    expect(dict.saveTck).not.toHaveBeenCalled();
  });
});
