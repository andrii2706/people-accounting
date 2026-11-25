import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../shared/services/employees.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  TCK_A,
  TCK_B,
  authStub,
  dictionariesStub,
  internals,
  toastStub,
} from '../../../testing/fixtures.testing';
import { TckDirectoryComponent } from './tck-directory.component';

const TCKS = [
  { ...TCK_A, region: 'Тестова область', city: 'Тестове', district: 'Шевченківський' },
  { ...TCK_B, region: 'Тестова область', city: 'Тестове', district: 'Франківський' },
  {
    ...TCK_A,
    id: 't3',
    name: 'Уявний ОТЦК та СП',
    region: 'Уявна область',
    city: 'Уявне',
    district: '',
  },
];

let dict: ReturnType<typeof dictionariesStub> & { importTck: ReturnType<typeof vi.fn> };
let toast: ReturnType<typeof toastStub>;

function render(auth = authStub()) {
  dict = {
    ...dictionariesStub(TCKS as never),
    importTck: vi.fn(async () => ({ created: 1, updated: 2 })),
  };
  toast = toastStub();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: DictionariesService, useValue: dict },
      { provide: ToastService, useValue: toast },
      {
        provide: EmployeesService,
        useValue: { tckMatches: vi.fn(async () => []), assignTck: vi.fn() },
      },
    ],
  });
  const fixture = TestBed.createComponent(TckDirectoryComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

type State = {
  tcks: () => { id: string }[];
  filtered: () => boolean;
  setQuery: (q: string) => void;
  setRegion: (r: string) => void;
  setCity: (c: string) => void;
  setDistrict: (d: string) => void;
  filter: () => Record<string, string>;
  resetFilter: () => void;
  cityOptions: () => { value: string }[];
  editTck: (t: object | null) => void;
  editingTck: () => string | null;
  tckModel: WritableSignal<Record<string, string>>;
  saveTck: (e: Event) => Promise<void>;
  addedTck: () => string | null;
  tckImport: WritableSignal<{ file: string; items: unknown[] } | null>;
  confirmTckImport: () => Promise<void>;
};

describe('TckDirectoryComponent — довідник ТЦК', () => {
  it('фільтри: область → місто → район; місто визначає область; скинути', () => {
    const s = internals<State>(render().fixture.componentInstance);
    expect(s.tcks()).toHaveLength(3);
    s.setCity('Тестове');
    expect(s.filter()['region']).toBe('Тестова область');
    expect(s.tcks().map((t) => t.id)).toEqual(['t1', 't2']);
    s.setDistrict('Франківський');
    expect(s.tcks().map((t) => t.id)).toEqual(['t2']);
    s.setRegion('Уявна область');
    expect(s.filter()['city']).toBe('');
    expect(s.cityOptions().map((o) => o.value)).toEqual(['Уявне']);
    s.setQuery('уявний');
    expect(s.filtered()).toBe(true);
    s.resetFilter();
    expect(s.filtered()).toBe(false);
  });

  it('кадровик додає новий ТЦК; після збереження — «Підтягнути в картки?»', async () => {
    const { fixture, el } = render();
    expect(el.textContent).toContain('Додати');
    expect(el.textContent).not.toContain('Імпорт');
    const s = internals<State>(fixture.componentInstance);
    s.editTck(null);
    expect(s.editingTck()).toBe('new');
    s.tckModel.update((m) => ({ ...m, name: 'Новий РТЦК та СП', postalCode: '01004' }));
    await s.saveTck(new Event('submit', { cancelable: true }));
    expect(dict.saveTck).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Новий РТЦК та СП' }),
      undefined,
    );
    expect(s.addedTck()).toBe('t-new');
    expect(toast.success).toHaveBeenCalledWith('ТЦК збережено');
  });

  it('редагування наявного — без пропозиції підтягнути; хибний індекс — не зберігає', async () => {
    const s = internals<State>(render(authStub({ isAdmin: () => true })).fixture.componentInstance);
    s.editTck(TCKS[0]);
    s.tckModel.update((m) => ({ ...m, postalCode: '1' }));
    await s.saveTck(new Event('submit', { cancelable: true }));
    expect(dict.saveTck).not.toHaveBeenCalled();
    s.tckModel.update((m) => ({ ...m, postalCode: '01001' }));
    await s.saveTck(new Event('submit', { cancelable: true }));
    expect(dict.saveTck).toHaveBeenCalledWith(expect.anything(), 't1');
    expect(s.addedTck()).toBeNull();
  });

  it('імпорт файлу (адміністратор): підтвердити — кількість нових і оновлених', async () => {
    const { fixture, el } = render(authStub({ isAdmin: () => true }));
    expect(el.textContent).toContain('Імпорт');
    const s = internals<State>(fixture.componentInstance);
    s.tckImport.set({ file: 'tck.json', items: [{ name: 'x' }] });
    await s.confirmTckImport();
    expect(toast.success).toHaveBeenCalledWith('Імпортовано: нових 1, оновлено 2');
    expect(s.tckImport()).toBeNull();
  });
});
