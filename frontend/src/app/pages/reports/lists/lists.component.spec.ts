import type { ListsPageData } from '../../../shared/interfaces/list-settings.interface';
import type { ListRow } from '../../../shared/interfaces/report.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { ListsService } from '../../../shared/services/lists.service';
import { renderPage } from '../../../testing/page.testing';
import { ListsComponent } from './lists.component';

/** Rows of fictional people: an officer with a reservation, a soldier with notices pending. */
const row = (
  id: string,
  section: ListRow['section'],
  status: Partial<ListRow['status']> = {},
): ListRow => ({
  employeeId: id,
  tckId: 't1',
  group: 'G1' as never,
  section,
  category: null,
  cells: Array.from({ length: 18 }, (_, i) =>
    i === 3 ? `Вигаданий ${id}` : i === 5 ? '' : `к${i + 1}`,
  ),
  status: {
    reserved: false,
    reservedByOther: false,
    reservedUntil: null,
    deferral: false,
    deferralUntil: null,
    deferralUntilMobilizationEnd: false,
    mobilized: false,
    mobilizationOrder: false,
    pendingNotices: 0,
    lastNoticeDate: null,
    warnings: 0,
    position: 'Інженер',
    positionSince: null,
    ...status,
  },
});
const SNAPSHOT = {
  id: 's1',
  legalEntityId: 'le1',
  date: '2026-11-01',
  total: 2,
  sections: {} as never,
  createdAt: '2026-11-01T09:00:00Z',
  createdByName: 'Кадровик Вигаданий',
};
const PAGE = (report = true): ListsPageData => ({
  snapshots: [SNAPSHOT],
  report: report
    ? {
        snapshot: SNAPSHOT,
        date: SNAPSHOT.date,
        counts: {} as never,
        rows: [
          row('e1', 'OFFICERS', { reserved: true }),
          row('e2', 'SOLDIERS', { pendingNotices: 2 }),
        ],
      }
    : null,
});

type State = {
  historyOptions: () => { value: string; label: string }[];
  total: () => number;
  title: (s: string) => string;
  sectionCounts: () => Map<string, number>;
  tab: { set: (t: string) => void };
  query: { set: (q: string) => void };
  quickCounts: () => Map<string, number>;
  filtering: () => boolean;
  visibleGroups: () => { group: string; rows: ListRow[] }[];
  shownGroups: () => { group: string; hasMore: boolean }[];
  showMore: (g: string) => void;
  toggleQuick: (f: string) => void;
  resetFilters: () => void;
  isExpanded: (r: ListRow) => boolean;
  toggleRow: (r: ListRow) => void;
  cell: (r: ListRow, c: number) => string;
  setFormDate: (d: string) => void;
  formDate: () => string;
  setEntity: (e: string) => void;
  setSnapshot: (id: string) => void;
  entityId: () => string;
  needsEntity: () => boolean;
  docxUrl: (s?: string) => string;
  form: () => Promise<void>;
  remove: () => Promise<void>;
  register: () => Promise<void>;
  capitalize: (t: string) => string;
};

function render(opts: { report?: boolean; confirm?: boolean } = {}) {
  const lists = {
    form: vi.fn(async () => ({ ...SNAPSHOT, id: 's2' })),
    remove: vi.fn(async () => undefined),
    snapshotDocxUrl: (id: string, section?: string) =>
      `api/reports/lists/snapshots/${id}/docx${section ? `?section=${section}` : ''}`,
  };
  const letters = { createReport: vi.fn(async () => ({ id: 'l1', number: '15' })) };
  const page = renderPage<ListsComponent, State>(ListsComponent, {
    inputs: { page: PAGE(opts.report ?? true) },
    providers: [
      { provide: ListsService, useValue: lists },
      { provide: LettersService, useValue: letters },
    ],
    confirm: opts.confirm,
  });
  return { ...page, lists, letters };
}

describe('ListsComponent — сформовані списки', () => {
  it('історія, вкладки, лічильники, пошук і швидкі фільтри', () => {
    const { s, update, el } = render();
    expect(el.textContent).toContain('Вигаданий e1');
    expect(s.historyOptions()[0].label).toContain('2 ос.');
    expect(s.total()).toBe(2);
    expect(s.title('OFFICERS')).toBe('OFFICERS');
    expect(s.sectionCounts().get('OFFICERS')).toBe(1);
    expect(s.quickCounts().get('RESERVED')).toBe(1);
    s.tab.set('SOLDIERS');
    expect(s.visibleGroups().map((g) => g.group)).toEqual(['SOLDIERS']);
    s.tab.set('ALL');
    s.toggleQuick('PENDING');
    expect(s.filtering()).toBe(true);
    expect(s.visibleGroups().flatMap((g) => g.rows.map((r) => r.employeeId))).toEqual(['e2']);
    s.toggleQuick('PENDING');
    s.query.set('e1');
    update();
    s.resetFilters();
    expect(s.filtering()).toBe(false);
    expect(s.shownGroups().every((g) => !g.hasMore)).toBe(true);
    s.showMore('OFFICERS');
    expect(s.capitalize('офіцери')).toBe('Офіцери');
  });

  it('розгорнути рядок; клітинка за номером колонки', () => {
    const { s, update } = render();
    const r = s.visibleGroups()[0].rows[0];
    s.toggleRow(r);
    expect(s.isExpanded(r)).toBe(true);
    update();
    s.toggleRow(r);
    expect(s.isExpanded(r)).toBe(false);
    expect(s.cell(r, 4)).toBe('Вигаданий e1');
    expect(s.cell(r, 6)).toBe('—');
  });

  it('дата формування — лише повна; юрособа і знімок — у адресі', () => {
    const { s, navigate } = render();
    s.setFormDate('2026-11');
    s.setFormDate('2026-11-15');
    expect(s.formDate()).toBe('2026-11-15');
    s.setEntity('le1');
    s.setSnapshot('');
    s.setSnapshot('s1');
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(s.entityId()).toBe('le1');
    expect(s.needsEntity()).toBe(false);
    expect(s.docxUrl('WOMEN')).toContain('section=WOMEN');
  });

  it('сформувати, видалити з підтвердженням, зареєструвати лист', async () => {
    const { s, lists, letters, toast, navigate } = render();
    await s.form();
    expect(lists.form).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Списки сформовано: 2 ос.'));
    await s.remove();
    expect(lists.remove).toHaveBeenCalledWith('s1');
    await s.register();
    expect(letters.createReport).toHaveBeenCalledWith({
      type: 'LISTS',
      reportDate: '2026-11-01',
      legalEntityId: 'le1',
      snapshotId: 's1',
    });
    expect(navigate).toHaveBeenCalledWith(['/letters', 'l1']);
    lists.form.mockRejectedValueOnce(new Error('x'));
    await s.form();
    lists.remove.mockRejectedValueOnce(new Error('x'));
    await s.remove();
    letters.createReport.mockRejectedValueOnce(new Error('x'));
    await s.register();
    expect(toast.error).toHaveBeenCalledTimes(3);
  });

  it('нічого не сформовано — видалити й зареєструвати недоступні; «Залишити»', async () => {
    const empty = render({ report: false });
    expect(empty.s.docxUrl()).toBe('');
    await empty.s.remove();
    await empty.s.register();
    expect(empty.lists.remove).not.toHaveBeenCalled();
    expect(empty.letters.createReport).not.toHaveBeenCalled();
  });

  it('видалити — скасовано', async () => {
    const { s, lists } = render({ confirm: false });
    await s.remove();
    expect(lists.remove).not.toHaveBeenCalled();
  });
});
