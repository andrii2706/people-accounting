import type { Provider, WritableSignal } from '@angular/core';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { dictionariesStub } from '../../../testing/fixtures.testing';
import { HttpErrorResponse } from '@angular/common/http';
import { EmployeesService } from '../../../shared/services/employees.service';
import { LettersService } from '../../../shared/services/letters.service';
import { employeeDetails } from '../../../testing/fixtures.testing';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { EmployeeFormComponent } from './employee-form.component';

type Model = Record<string, unknown> & {
  familyMembers: unknown[];
  militaryDocuments: { type: string; number: string; series: string; issuedBy: string }[];
  positions: { department: string }[];
  educations: unknown[];
};
type State = {
  model: WritableSignal<Model>;
  isEdit: () => boolean;
  changedLabels: () => string[];
  tab: WritableSignal<string>;
  tabErrors: () => Record<string, boolean>;
  errorList: () => { key: string; tab: string }[];
  saveError: () => string;
  save: (e: Event) => Promise<void>;
  cancel: () => void;
  addFamilyMember: (r: string) => void;
  removeFamilyMember: (i: number) => void;
  addDocument: () => void;
  removeDocument: (i: number) => void;
  addPosition: () => void;
  removePosition: (i: number) => void;
  addEducation: () => void;
  removeEducation: (i: number) => void;
  setDeferralKind: (k: string) => void;
  isElectronic: (t: string) => boolean;
  relationLabel: (r: string) => string;
  tckAutoFilled: () => boolean;
  completion: () => unknown;
  sections: () => unknown[];
  preview: () => unknown;
  setNotice: (type: 'HIRE' | 'DISMISSAL', key: 'number' | 'date', value: string) => void;
  hireNoticeError: () => string;
  goTo: (i: { key: string; tab: string }) => void;
};

function render(inputs: Record<string, unknown> = {}, extra: Provider[] = []) {
  const employees = {
    create: vi.fn(async () => employeeDetails({ id: 'e9' })),
    update: vi.fn(async () =>
      employeeDetails({ changes: [{ id: 'c1', letter: null, skipped: false }] as never }),
    ),
  };
  const letters = { createExternalNotice: vi.fn(async () => ({ id: 'l1' })) };
  const page = renderPage<EmployeeFormComponent, State>(EmployeeFormComponent, {
    inputs,
    providers: [
      { provide: EmployeesService, useValue: employees },
      { provide: LettersService, useValue: letters },
      ...extra,
    ],
  });
  page.http.match(() => true).forEach((r) => r.flush({ mobilizationUntil: '2027-02-05' }));
  return { ...page, employees, letters };
}

/** A new card filled in with a fictional person — the fields the form requires. */
function fill(s: State) {
  s.model.update((m) => ({
    ...m,
    lastName: 'Вигаданий',
    firstName: 'Петро',
    middleName: 'Іванович',
    gender: 'F',
    birthDate: '1990-01-01',
    position: 'Інженер',
    hireDate: '2020-01-01',
    legalEntityId: 'le1',
    militaryRegistered: false,
    positions: m.positions.length
      ? m.positions.map((p) => ({ ...p, position: 'Інженер', since: '2020-01-01' }))
      : [
          {
            position: 'Інженер',
            department: '',
            since: '2020-01-01',
            orderDocName: '',
            orderNumber: '',
            orderDate: '',
          },
        ],
  }));
}

describe('EmployeeFormComponent — нова картка', () => {
  it('порожня — не зберігає, показує помилки й переходить до першої', async () => {
    const { s, employees } = render();
    expect(s.isEdit()).toBe(false);
    await s.save(submitEvent());
    expect(employees.create).not.toHaveBeenCalled();
    expect(s.saveError()).toContain('виправте позначені поля');
    expect(s.errorList().length).toBeGreaterThan(0);
    expect(Object.values(s.tabErrors()).some(Boolean)).toBe(true);
  });

  it('заповнена — створює і переходить до картки', async () => {
    const { s, employees, navigate, toast, update } = render();
    fill(s);
    update();
    await s.save(submitEvent());
    expect(employees.create).toHaveBeenCalledWith(
      expect.objectContaining({ lastName: 'Вигаданий', firstName: 'Петро' }),
    );
    expect(navigate).toHaveBeenCalledWith(['/employees', 'e9']);
    expect(toast.success).toHaveBeenCalledWith('Збережено');
  });

  it('помилки сервера — під полями; інша помилка — текстом над формою', async () => {
    const { s, employees, update } = render();
    fill(s);
    update();
    employees.create.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Bad', errors: [{ field: 'rnokpp', message: 'Невірний РНОКПП' }] },
      }),
    );
    await s.save(submitEvent());
    expect(s.saveError()).toBeTruthy();
    employees.create.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 500, error: { message: 'Збій' } }),
    );
    await s.save(submitEvent());
    expect(s.saveError()).toBeTruthy();
  });

  it('чоловік — на військовому обліку за замовчуванням; ТЦК — з «ким виданий» документа', () => {
    const { s, update } = render();
    s.model.update((m) => ({ ...m, gender: 'M' }));
    update();
    expect(s.model()['militaryRegistered']).toBe(true);
    s.addDocument();
    s.model.update((m) => ({
      ...m,
      militaryDocuments: [{ ...m.militaryDocuments[0], issuedBy: 'Шевченківським РТЦК та СП' }],
    }));
    update();
    expect(s.model()['tckId']).toBe('t1');
    expect(s.tckAutoFilled()).toBe(true);
  });

  it('списки в картці: родина, документи, посади, освіта; вид відстрочки', () => {
    const { s, update } = render();
    fill(s);
    s.addFamilyMember('WIFE');
    s.addFamilyMember('HUSBAND');
    expect(s.model().familyMembers).toHaveLength(2);
    s.removeFamilyMember(0);
    expect(s.model().familyMembers).toHaveLength(1);
    s.addDocument();
    s.model.update((m) => ({
      ...m,
      militaryDocuments: [{ ...m.militaryDocuments[0], number: '123', series: 'АА' }],
    }));
    update();
    s.model.update((m) => ({
      ...m,
      militaryDocuments: [
        { ...m.militaryDocuments[0], type: 'військово-обліковий документ в електронній формі' },
      ],
    }));
    update();
    expect(s.model().militaryDocuments[0].number).toBe('');
    s.removeDocument(0);
    s.addPosition();
    s.addPosition();
    expect(s.model().positions.length).toBeGreaterThanOrEqual(2);
    s.removePosition(0);
    s.addEducation();
    s.removeEducation(0);
    s.setDeferralKind('UNTIL_MOBILIZATION_END');
    expect(s.model()['deferralKind']).toBe('UNTIL_MOBILIZATION_END');
    expect(s.isElectronic('військово-обліковий документ в електронній формі')).toBe(true);
    expect(s.relationLabel('WIFE')).toBe('WIFE');
    expect(s.completion()).toBeTruthy();
    expect(s.sections().length).toBeGreaterThan(0);
    expect(s.preview()).toBeTruthy();
  });

  it('перехід до поля з помилкою — на його вкладку', () => {
    const { s } = render();
    s.goTo({ key: 'hireDate', tab: 'work' });
    expect(s.tab()).toBe('work');
  });

  it('скасувати — до списку', () => {
    const { s, navigate } = render();
    s.cancel();
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });
});

describe('EmployeeFormComponent — редагування', () => {
  it('змінене поле — у переліку змін; збереження з чергою для ТЦК', async () => {
    const e = employeeDetails({ gender: 'F', rankCode: null, militaryRegistered: false } as never);
    const { s, employees, toast, update } = render({ id: 'e1', employee: e });
    expect(s.isEdit()).toBe(true);
    s.model.update((m) => ({ ...m, lastName: 'Змінений' }));
    update();
    expect(s.changedLabels().length).toBeGreaterThan(0);
    await s.save(submitEvent());
    expect(s.errorList().map((x) => x.key)).toEqual([]);
    expect(employees.update).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ lastName: 'Змінений' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Збережено. У черзі для ТЦК: 1');
  });

  it('номер і дата повідомлення про прийняття: неповні — не зберігає', async () => {
    const { s, employees } = render({ id: 'e1', employee: employeeDetails() });
    s.setNotice('HIRE', 'number', '15');
    await s.save(submitEvent());
    expect(s.hireNoticeError()).toBeTruthy();
    expect(employees.update).not.toHaveBeenCalled();
    expect(s.saveError()).toContain('повідомлення до ТЦК');
  });

  it('скасувати — до картки', () => {
    const { s, navigate } = render({ id: 'e1', employee: employeeDetails() });
    s.cancel();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'e1']);
  });
});

/** Directories of a test: two ranks and short lists — enough to draw every tab. */
const RANKS = [
  {
    code: 0,
    army: 'рядовий (призовник)',
    navy: 'матрос',
    ageLimit: 60,
    composition: 'C',
    compositionLabel: 'призовники',
  },
  {
    code: 3,
    army: 'сержант',
    navy: 'старшина 2 статті',
    ageLimit: 60,
    composition: 'S',
    compositionLabel: 'сержанти',
  },
  {
    code: 12,
    army: 'лейтенант',
    navy: 'лейтенант',
    ageLimit: 60,
    composition: 'O',
    compositionLabel: 'офіцери',
  },
];
const richDictionaries = () => ({
  provide: DictionariesService,
  useValue: {
    ...dictionariesStub(),
    ranks: () => RANKS,
    rank: (code: number) => RANKS.find((r) => r.code === code),
    dictionaries: () => ({
      militaryDocumentTypes: [
        'військовий квиток',
        'військово-обліковий документ в електронній формі',
      ],
      fitnessStatuses: ['придатний'],
      educationLevels: ['вища'],
      maritalStatuses: [{ value: 'MARRIED', labelM: 'одружений', labelF: 'заміжня' }],
      familyRelations: [{ value: 'WIFE', label: 'Дружина' }],
      listSections: [{ value: 'OFFICERS', label: 'Офіцери' }],
    }),
  },
});

describe('EmployeeFormComponent — усі вкладки', () => {
  it('кожна вкладка малюється: офіцер, сержант, призовник; паспорт-книжка; ВЛК', () => {
    const e = employeeDetails({ gender: 'M', militaryRegistered: true } as never);
    const { s, update, el } = render({ id: 'e1', employee: e }, [richDictionaries()]);
    for (const code of ['12', '3', '0']) {
      s.model.update((m) => ({
        ...m,
        rankCode: code,
        passportType: code === '0' ? 'ID_CARD' : 'BOOK',
        passportNumber: '123456',
        fitnessDate: '2026-01-10',
        nextVlkDate: '2025-01-01',
        reserveTeamNumber: code === '3' ? '7' : '',
        navy: code === '3',
      }));
      for (const tab of [
        'personal',
        'passport',
        'education',
        'family',
        'work',
        'military',
        'notes',
      ]) {
        s.tab.set(tab);
        update();
      }
    }
    s.addFamilyMember('WIFE');
    update();
    expect(s.relationLabel('WIFE')).toBe('Дружина');
    expect(el.textContent).toContain('Примітки');
  });
});
