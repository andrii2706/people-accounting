import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  QuotaPageData,
  QuotaRecalculation,
} from '../../../shared/interfaces/legal-entity.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { authStub, internals, toastStub } from '../../../testing/fixtures.testing';
import { QuotaComponent } from './quota.component';

const ROW = (over: Partial<QuotaRecalculation> = {}): QuotaRecalculation => ({
  id: 'r1',
  createdAt: '2026-11-24T10:00:00Z',
  reason: 'Звільнено',
  base: 10,
  prevBase: 11,
  quota: 5,
  prevQuota: 5,
  reservedCompany: 6,
  prevReserved: 6,
  available: 0,
  exceeded: true,
  ...over,
});

/** A fictional legal entity whose quota is exceeded by one. */
const DATA: QuotaPageData = {
  entityId: 'le1',
  entityName: 'Вигадана компанія',
  quota: {
    id: 'le1',
    name: 'Вигадана компанія',
    percent: 50,
    base: 10,
    mobilizedInBase: 0,
    partTimeExcluded: 0,
    quota: 5,
    reservedCompany: 6,
    available: 0,
    exceeded: true,
    validUntil: '2026-12-31',
  } as never,
  docName: 'Рішення',
  docDate: '2026-01-10',
  docNumber: '15',
  recalculations: [
    ROW(),
    ROW({ id: 'r2', quota: null, exceeded: false, available: null }),
    ROW({ id: 'r3', exceeded: false, available: 2, reservedCompany: 3 }),
  ],
  notify: { exceeded: true, decreased: true, expiring: false },
  recipients: 3,
  extraEmails: ['hr@example.com'],
  mailConfigured: true,
};

let saveQuotaNotify: ReturnType<typeof vi.fn>;
let toast: ReturnType<typeof toastStub>;

function render(data: QuotaPageData = DATA) {
  saveQuotaNotify = vi.fn(async (_id: string, patch: object) => ({ ...data.notify, ...patch }));
  toast = toastStub();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub({ isAdmin: () => true }) },
      { provide: LegalEntitiesService, useValue: { saveQuotaNotify } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(QuotaComponent);
  fixture.componentRef.setInput('data', data);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

type State = {
  over: () => number;
  step: (a: number | null, b: number | null) => string;
  state: (r: QuotaRecalculation) => { label: string; tone: string };
  notify: () => Record<string, boolean>;
  toggle: (k: 'exceeded' | 'decreased' | 'expiring', v: boolean) => Promise<void>;
};

describe('QuotaComponent — квота бронювання', () => {
  it('перевищення видно на сторінці; історія перерахунків', () => {
    const { fixture, el } = render();
    const s = internals<State>(fixture.componentInstance);
    expect(s.over()).toBe(1);
    expect(el.textContent).toContain('Вигадана компанія');
    expect(el.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(3);
  });

  it('зміна у рядку історії: «11 → 10»; без зміни — одне число', () => {
    const s = internals<State>(render().fixture.componentInstance);
    expect(s.step(11, 10)).toBe('11 → 10');
    expect(s.step(10, 10)).toBe('10');
    expect(s.step(null, 7)).toBe('7');
    expect(s.step(3, null)).toBe('3 → —');
  });

  it('стан рядка: перевищено / 0 вільних / вільні / без квоти', () => {
    const s = internals<State>(render().fixture.componentInstance);
    expect(s.state(ROW())).toEqual({ label: 'перевищено на 1', tone: 'bad' });
    expect(s.state(ROW({ exceeded: false, available: 0 }))).toEqual({
      label: '0 вільних',
      tone: 'warn',
    });
    expect(s.state(ROW({ exceeded: false, available: 2 }))).toEqual({
      label: 'вільних 2',
      tone: 'ok',
    });
    expect(s.state(ROW({ quota: null }))).toEqual({ label: 'квоту не задано', tone: 'muted' });
  });

  it('листи: увімкнути / вимкнути — збережено, повідомлення', async () => {
    const { fixture } = render();
    const s = internals<State>(fixture.componentInstance);
    await s.toggle('expiring', true);
    expect(saveQuotaNotify).toHaveBeenCalledWith('le1', { expiring: true });
    expect(s.notify()['expiring']).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Лист увімкнено');
    saveQuotaNotify.mockRejectedValueOnce(new Error('offline'));
    await s.toggle('exceeded', false);
    expect(toast.error).toHaveBeenCalled();
    expect(s.notify()['exceeded']).toBe(true);
  });
});
