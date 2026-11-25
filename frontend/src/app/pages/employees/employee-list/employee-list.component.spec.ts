import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { EmployeeList } from '../../../shared/interfaces/employee.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { authStub, dictionariesStub, internals, listItem } from '../../../testing/fixtures.testing';
import { EmployeeListComponent } from './employee-list.component';

const LIST = {
  date: '2026-11-24',
  total: 3,
  items: [
    listItem({ id: 'e1', lastName: 'Бойко', personnelNumber: '001' }),
    listItem({
      id: 'e2',
      lastName: 'Антоненко',
      legalEntityId: 'le2',
      pendingChanges: 2,
      warnings: [{ level: 'danger', code: 'x' }],
    }),
    listItem({
      id: 'e3',
      lastName: 'Ващук',
      dismissalDate: '2026-10-01',
      dismissalOrderNumber: '12-к',
      dismissalNotice: { status: 'PENDING', letterNumber: null, deadline: '2026-10-08' },
    }),
  ],
} as unknown as EmployeeList;

function render(inputs: Record<string, string> = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub() },
      { provide: DictionariesService, useValue: dictionariesStub() },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EmployeeListComponent);
  fixture.componentRef.setInput('list', LIST);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

type State = {
  currentView: () => string;
  items: () => { id: string }[];
  workingCount: () => number;
  counts: () => Map<string, number>;
  dismissedView: () => boolean;
  dismissedXlsxUrl: () => string;
  toggle: (id: string) => void;
  toggleAll: () => void;
  allSelected: () => boolean;
  clearSelection: () => void;
  selectedExtractUrl: () => string | null;
  preview: (i: { id: string }) => void;
  previewItem: () => { id: string } | null;
  employeeActions: (i: object, previewed: boolean) => { label: string; run: () => void }[];
  setView: (v: string) => void;
};

describe('EmployeeListComponent — дві таблиці: працюють і звільнені', () => {
  it('«Працюють» — без звільнених; табельний номер у таблиці', () => {
    const { fixture, el } = render();
    const s = internals<State>(fixture.componentInstance);
    expect(s.currentView()).toBe('all');
    expect(s.items().map((i) => i.id)).toEqual(['e1', 'e2']);
    expect(s.workingCount()).toBe(2);
    expect(s.counts().get('dismissed')).toBe(1);
    expect(el.textContent).toContain('001');
  });

  it('«Звільнені» — окрема таблиця з наказом, повідомленням ТЦК і вивантаженням .xlsx', () => {
    const { fixture, el } = render({ view: 'dismissed', search: 'Ващ', entity: 'le1' });
    const s = internals<State>(fixture.componentInstance);
    expect(s.dismissedView()).toBe(true);
    expect(s.items().map((i) => i.id)).toEqual(['e3']);
    expect(s.dismissedXlsxUrl()).toBe(
      'api/employees/dismissed.xlsx?legalEntityId=le1&search=%D0%92%D0%B0%D1%89',
    );
    expect(el.textContent).toContain('12-к');
    expect(el.querySelector('a[href*="dismissed.xlsx"]')).not.toBeNull();
  });

  it('старі посилання: ?status=dismissed і ?warnings=1', () => {
    expect(
      internals<State>(render({ status: 'dismissed' }).fixture.componentInstance).currentView(),
    ).toBe('dismissed');
    TestBed.resetTestingModule();
    expect(
      internals<State>(render({ warnings: '1' }).fixture.componentInstance).currentView(),
    ).toBe('attention');
  });

  it('вибір рядків: витяг лише для однієї юрособи', () => {
    const { fixture } = render();
    const s = internals<State>(fixture.componentInstance);
    s.toggle('e1');
    expect(s.selectedExtractUrl()).toContain('ids=e1');
    s.toggle('e2');
    expect(s.selectedExtractUrl()).toBeNull();
    s.toggleAll();
    expect(s.allSelected()).toBe(false);
    s.clearSelection();
    s.toggleAll();
    expect(s.allSelected()).toBe(true);
  });

  it('перегляд збоку і дії рядка: редагувати, копіювати', () => {
    const { fixture, navigate } = render();
    const s = internals<State>(fixture.componentInstance);
    const item = s.items()[0];
    s.preview(item);
    expect(s.previewItem()?.id).toBe('e1');
    const actions = s.employeeActions(item, true);
    expect(actions.map((a) => a.label)).toEqual(['Сховати перегляд', 'Редагувати', 'Копіювати']);
    actions[1].run();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'e1', 'edit']);
    actions[2].run();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'new'], { queryParams: { copy: 'e1' } });
    s.setView('dismissed');
    expect(s.previewItem()).toBeNull();
  });
});
