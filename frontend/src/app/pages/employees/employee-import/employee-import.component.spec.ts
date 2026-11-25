import { HttpErrorResponse } from '@angular/common/http';
import type { WritableSignal } from '@angular/core';
import type {
  CheckedImportRow,
  ImportPreview,
} from '../../../shared/interfaces/employee-import.interface';
import { EmployeeImportService } from '../../../shared/services/employee-import.service';
import { todayIso } from '../../../shared/utils/date.utils';
import { renderPage } from '../../../testing/page.testing';
import { EmployeeImportComponent } from './employee-import.component';

/** Rows of a file with fictional people: ready, with an error, a duplicate. */
const row = (n: number, over: Partial<CheckedImportRow> = {}): CheckedImportRow =>
  ({
    rowNumber: n,
    values: { lastName: `Вигаданий${n}`, firstName: 'Петро', hireDate: todayIso() },
    issues: [],
    errors: [],
    duplicate: null,
    fullName: `Вигаданий${n} Петро`,
    ...over,
  }) as CheckedImportRow;
const PREVIEW = {
  fileName: 'працівники.xlsx',
  mapping: [
    { header: 'Прізвище', field: 'lastName' },
    { header: 'Примітка', field: null },
  ],
  rows: [
    row(2),
    row(3, { values: { lastName: 'Старий', hireDate: '2015-01-01' } }),
    row(4, { errors: [{ field: 'rnokpp', message: 'Невірний РНОКПП' }] }),
    row(5, { duplicate: { id: 'e1', fullName: 'x', by: 'name' } as never }),
  ],
} as unknown as ImportPreview;

type State = {
  preview: () => ImportPreview | null;
  rows: WritableSignal<CheckedImportRow[]>;
  counts: () => Record<string, number>;
  filter: WritableSignal<string>;
  visibleRows: () => CheckedImportRow[];
  selectedCount: () => number;
  noticeCounts: () => { ALL: number; RECENT: number };
  recognized: () => unknown[];
  ignored: () => unknown[];
  onFile: (e: Event) => void;
  onDrop: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  dragOver: () => boolean;
  reset: () => void;
  toggle: (r: CheckedImportRow, c: boolean) => void;
  toggleAll: (c: boolean) => void;
  toggleExpanded: (r: CheckedImportRow) => void;
  expanded: () => number | null;
  fieldsOf: (r: CheckedImportRow) => { key: string }[];
  errorsOf: (r: CheckedImportRow, f: string) => string[];
  text: (r: CheckedImportRow, k: string) => string;
  setValue: (r: CheckedImportRow, k: string, v: string | boolean) => void;
  dirty: () => boolean;
  isLockedByDocType: (r: CheckedImportRow, k: string) => boolean;
  rankLabel: (c: unknown, n: unknown) => string;
  tckLabel: (id: unknown) => string;
  recheck: () => Promise<void>;
  commit: () => Promise<void>;
  hireNotices: WritableSignal<string>;
};

function render() {
  const importer = {
    templateUrl: 'api/employees/import/template',
    preview: vi.fn(async () => PREVIEW),
    check: vi.fn(async (rows: CheckedImportRow[]) => rows.map((r) => ({ ...r, errors: [] }))),
    commit: vi.fn(async () => ({ created: 2, notices: 1, ids: [] })),
  };
  const page = renderPage<EmployeeImportComponent, State>(EmployeeImportComponent, {
    providers: [{ provide: EmployeeImportService, useValue: importer }],
  });
  return { ...page, importer };
}

const fileEvent = (name: string, size = 10) => {
  const file = new File(['x'.repeat(size)], name);
  return { target: { files: [file], value: name } } as unknown as Event;
};
const flush = () => new Promise((r) => setTimeout(r));

describe('EmployeeImportComponent — імпорт з файлу', () => {
  it('файл → перевірені рядки: помилки показано першими, готові обрано', async () => {
    const { s, importer } = render();
    s.onFile(fileEvent('працівники.xlsx'));
    await flush();
    expect(importer.preview).toHaveBeenCalled();
    expect(s.counts()).toEqual({ all: 4, ready: 2, error: 1, duplicate: 1 });
    expect(s.filter()).toBe('error');
    expect(s.visibleRows().map((r) => r.rowNumber)).toEqual([4]);
    expect(s.selectedCount()).toBe(2);
    expect(s.noticeCounts()).toEqual({ ALL: 2, RECENT: 1 });
    expect(s.recognized()).toHaveLength(1);
    expect(s.ignored()).toHaveLength(1);
  });

  it('не .xlsx/.csv чи завеликий — відмова без запиту; перетягування файлу', async () => {
    const { s, importer, toast } = render();
    s.onFile(fileEvent('старий.xls'));
    s.onFile(fileEvent('великий.xlsx', 6 * 1024 * 1024));
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(importer.preview).not.toHaveBeenCalled();
    s.onDragOver({ preventDefault: () => undefined } as DragEvent);
    expect(s.dragOver()).toBe(true);
    s.onDrop({
      preventDefault: () => undefined,
      dataTransfer: { files: [new File(['x'], 'a.csv')] },
    } as unknown as DragEvent);
    await flush();
    expect(importer.preview).toHaveBeenCalled();
    expect(s.dragOver()).toBe(false);
  });

  it('правка рядка: значення, звання числом, єВОД без номера, чоловік — на обліку; перевірити ще раз', async () => {
    const { s, importer } = render();
    s.onFile(fileEvent('a.xlsx'));
    await flush();
    const bad = s.rows().find((r) => r.rowNumber === 4)!;
    expect(s.errorsOf(bad, 'rnokpp')).toEqual(['Невірний РНОКПП']);
    expect(s.fieldsOf(bad).some((f) => f.key === 'rnokpp')).toBe(true);
    s.setValue(bad, 'rnokpp', ' 1234567890 ');
    expect(s.dirty()).toBe(true);
    s.setValue(bad, 'rankCode', '1');
    s.setValue(bad, 'gender', 'M');
    s.setValue(bad, 'militaryDocNumber', '123');
    s.setValue(bad, 'militaryDocType', 'військово-обліковий документ в електронній формі');
    const edited = s.rows().find((r) => r.rowNumber === 4)!;
    expect(edited.values).toMatchObject({
      rnokpp: '1234567890',
      rankCode: 1,
      militaryRegistered: true,
    });
    expect(edited.values['militaryDocNumber']).toBeUndefined();
    expect(s.isLockedByDocType(edited, 'militaryDocNumber')).toBe(true);
    s.setValue(edited, 'rnokpp', '');
    expect(
      s.text(
        s.rows().find((r) => r.rowNumber === 4)!,
        'rnokpp',
      ),
    ).toBe('');
    await s.recheck();
    expect(importer.check).toHaveBeenCalled();
    expect(s.dirty()).toBe(false);
    s.toggleExpanded(edited);
    expect(s.expanded()).toBe(4);
    s.toggleExpanded(edited);
    expect(s.expanded()).toBeNull();
    expect(s.rankLabel('x', false)).toBe('');
    expect(s.tckLabel('t1')).toBe('Шевченківський РТЦК та СП');
  });

  it('імпорт обраних: повідомлення про недавно прийнятих; перехід до списку', async () => {
    const { s, importer, navigate, toast } = render();
    s.onFile(fileEvent('a.xlsx'));
    await flush();
    s.toggle(s.rows()[1], false);
    expect(s.selectedCount()).toBe(1);
    s.toggleAll(true);
    expect(s.selectedCount()).toBe(2);
    s.toggleAll(false);
    await s.commit();
    expect(importer.commit).not.toHaveBeenCalled();
    s.toggleAll(true);
    await s.commit();
    expect(importer.commit).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ hireNotices: 'RECENT', fileName: 'працівники.xlsx' }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Імпортовано працівників: 2, створено повідомлень ТЦК: 1',
    );
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('сервер знайшов зміни — рядки оновлено з його перевірки', async () => {
    const { s, importer, toast } = render();
    s.onFile(fileEvent('a.xlsx'));
    await flush();
    importer.commit.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: {
          message: ['Дані змінилися'],
          rows: [row(2, { duplicate: { id: 'e2', fullName: 'y', by: 'rnokpp' } as never })],
        },
      }),
    );
    await s.commit();
    expect(s.rows()[0].duplicate).toBeTruthy();
    expect(toast.error).toHaveBeenCalled();
    s.reset();
    expect(s.preview()).toBeNull();
  });

  it('помилки сервера при читанні й перевірці', async () => {
    const { s, importer, toast } = render();
    importer.preview.mockRejectedValueOnce(new Error('offline'));
    s.onFile(fileEvent('a.xlsx'));
    await flush();
    importer.check.mockRejectedValueOnce(new Error('offline'));
    await s.recheck();
    expect(toast.error).toHaveBeenCalledTimes(2);
  });
});
