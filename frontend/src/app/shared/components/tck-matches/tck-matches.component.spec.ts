import { TestBed } from '@angular/core/testing';
import { EmployeesService } from '../../services/employees.service';
import { ToastService } from '../../services/toast.service';
import { internals, toastStub } from '../../../testing/fixtures.testing';
import { TckMatchesComponent } from './tck-matches.component';

// fictional people whose military document was issued by the new TCK
const MATCHES = [
  { id: 'e1', fullName: 'Вигаданий Петро Іванович', issuedBy: 'Новим РТЦК та СП' },
  { id: 'e2', fullName: 'Тестова Олена Петрівна', issuedBy: 'Новим РТЦК та СП' },
];

let tckMatches: ReturnType<typeof vi.fn>;
let assignTck: ReturnType<typeof vi.fn>;
let toast: ReturnType<typeof toastStub>;

async function render(tckId: string | null = 't-new') {
  tckMatches = vi.fn(async () => MATCHES);
  assignTck = vi.fn(async (_t: string, ids: string[]) => ({ assigned: ids.length }));
  toast = toastStub();
  TestBed.configureTestingModule({
    providers: [
      { provide: EmployeesService, useValue: { tckMatches, assignTck } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(TckMatchesComponent);
  fixture.componentRef.setInput('tckId', tckId);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const assigned = vi.fn();
  fixture.componentInstance.assigned.subscribe(assigned);
  return { fixture, assigned, el: fixture.nativeElement as HTMLElement };
}

type State = {
  chosen: () => ReadonlySet<string>;
  toggle: (id: string) => void;
  assign: () => Promise<void>;
  empty: () => boolean;
};

describe('TckMatchesComponent — «Підтягнути в картки?»', () => {
  it('знайдені люди — усі обрані; список на екрані', async () => {
    const { fixture, el } = await render();
    expect(tckMatches).toHaveBeenCalledWith('t-new');
    expect([...internals<State>(fixture.componentInstance).chosen()]).toEqual(['e1', 'e2']);
    expect(el.textContent).toContain('Вигаданий Петро Іванович');
  });

  it('зняти одного — ТЦК підставляється лише іншим', async () => {
    const { fixture, assigned } = await render();
    const s = internals<State>(fixture.componentInstance);
    s.toggle('e1');
    await s.assign();
    expect(assignTck).toHaveBeenCalledWith('t-new', ['e2']);
    expect(toast.success).toHaveBeenCalledWith('ТЦК підставлено в 1 картк.');
    expect(assigned).toHaveBeenCalledWith(1);
    expect(s.empty()).toBe(true);
    s.toggle('e1');
    expect(s.chosen().has('e1')).toBe(true);
  });

  it('помилка сервера — повідомлення; без ТЦК — нічого не запитує', async () => {
    const { fixture } = await render();
    assignTck.mockRejectedValueOnce(new Error('offline'));
    await internals<State>(fixture.componentInstance).assign();
    expect(toast.error).toHaveBeenCalled();
    TestBed.resetTestingModule();
    const none = await render(null);
    expect(tckMatches).not.toHaveBeenCalled();
    expect(internals<State>(none.fixture.componentInstance).empty()).toBe(true);
  });
});
