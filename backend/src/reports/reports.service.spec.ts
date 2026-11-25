import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wire } from '../../test/wiring.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { ChangeNotice } from '../letters/entities/change-notice.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import type { ListDocumentsService } from './lists/list-documents.service.js';
import { ReportsService } from './reports.service.js';

const DATE = '2026-11-24';
let w: ReturnType<typeof wire>;
let docs: { render: ReturnType<typeof vi.fn>; sheets: ReturnType<typeof vi.fn> };
let service: ReportsService;

beforeEach(() => {
  w = wire();
  docs = {
    render: vi.fn(async () => ({ kind: 'docx', buffer: Buffer.from('PK') })),
    sheets: vi.fn(async () => new Map([['SOLDIERS', 1]])),
  };
  service = new ReportsService(
    w.db.getRepository(Employee) as never,
    w.db.getRepository(EmployeeChange) as never,
    w.db.getRepository(Tck) as never,
    w.org,
    w.legalEntities,
    docs as unknown as ListDocumentsService,
  );
});

/** Soldiers (men with a rank), a woman, a man without registration, a dismissed one. */
function staff() {
  const a = w.seedEmployee({ lastName: 'Бойко', tckId: 't1' });
  const b = w.seedEmployee({ lastName: 'Антоненко', tckId: 't2' });
  const f = w.seedEmployee({
    lastName: 'Вовк',
    firstName: 'Олена',
    middleName: 'Петрівна',
    gender: 'F',
    rankCode: null,
    tckId: 't1',
  });
  const n = w.seedEmployee({ lastName: 'Гнатюк', militaryRegistered: false });
  const d = w.seedEmployee({ lastName: 'Дмитренко', tckId: 't1', dismissalDate: '2026-03-01' });
  return { a, b, f, n, d };
}

describe('ReportsService.lists — списки персонального обліку', () => {
  it('лише ті, хто на обліку; звільнені цього року лишаються; нумерація в межах списку', async () => {
    const { n } = staff();
    const { rows, counts } = await service.lists(DATE);
    expect(rows.map((r) => r.employeeId)).not.toContain(n.id);
    expect(rows).toHaveLength(4);
    const bySection = new Map<string, string[]>();
    for (const r of rows) bySection.set(r.section, [...(bySection.get(r.section) ?? []), r.cells[0]]);
    for (const numbers of bySection.values()) expect(numbers).toEqual(numbers.map((_, i) => String(i + 1)));
    expect(counts.LIABLE + counts.RESERVIST + counts.CONSCRIPT).toBe(4);
  });

  it('витяг: без звільнених, лише свій ТЦК чи обрані люди', async () => {
    const { a, d } = staff();
    const byTck = await service.lists(DATE, { tckId: 't1' });
    expect(byTck.rows.map((r) => r.employeeId)).not.toContain(d.id);
    expect(byTck.rows.every((r) => r.tckId === 't1')).toBe(true);
    const chosen = await service.lists(DATE, { onlyIds: [a.id] });
    expect(chosen.rows.map((r) => r.employeeId)).toEqual([a.id]);
  });

  it('колонка 18: повідомлення про призначення / звільнення з номером листа; черга — у статусі', async () => {
    const { a } = staff();
    const [letter] = w.db
      .getRepository(OutgoingLetter)
      .seed({ id: 'l1', number: 'ВО-5', date: '2026-02-01', type: 'CHANGE_NOTICE', year: 2026, sequence: 5 } as never);
    w.db
      .getRepository(EmployeeChange)
      .seed(
        { employeeId: a.id, type: 'HIRE', effectiveDate: '2020-01-01', letterId: letter.id } as never,
        { employeeId: a.id, type: 'LAST_NAME', effectiveDate: '2026-11-01' } as never,
      );
    w.db.getRepository(ChangeNotice).seed({
      letterId: 'l1',
      sequence: 1,
      employeeId: a.id,
      employeeName: 'Бойко',
      changeType: 'HIRE',
      effectiveDate: '2020-01-01',
      content: '{}',
    } as never);
    const row = (await service.lists(DATE)).rows.find((r) => r.employeeId === a.id)!;
    expect(row.cells.join(' ')).toContain('про призначення: вих. № ВО-5 від 01.02.2026 р.');
    expect(row.cells.join(' ').match(/ВО-5/g)).toHaveLength(1);
    expect(row.status).toBeTruthy();
  });
});

describe('ReportsService: документи списків', () => {
  it('listsDocx: дані на дату для юрособи; порожній витяг — помилка', async () => {
    staff();
    await service.listsDocx(DATE, { legalEntityId: 'le1' });
    expect(docs.render).toHaveBeenCalledWith(expect.objectContaining({ legalEntityId: 'le1', extract: false }));
    await expect(service.listsDocx(DATE, { legalEntityId: 'le1', onlyIds: ['nobody'] })).rejects.toThrow(
      'витяг не потрібен',
    );
  });

  it('extractRows: зі знімка — без звільнених на дату, нумерація заново', async () => {
    const { a, d } = staff();
    const formed = [
      { employeeId: d.id, tckId: 't1', section: 'SOLDIERS', cells: ['1', 'x'] },
      { employeeId: a.id, tckId: 't1', section: 'SOLDIERS', cells: ['2', 'y'] },
    ] as never;
    const kept = await service.extractRows(formed, DATE, { tckId: 't1' });
    expect(kept.map((r) => [r.employeeId, r.cells[0]])).toEqual([[a.id, '1']]);
    expect(await service.extractRows(formed, DATE, { tckId: 't2' })).toEqual([]);
    await service.listsDocx(DATE, { legalEntityId: 'le1', rows: formed, tckId: 't1' });
    expect(docs.render).toHaveBeenLastCalledWith(expect.objectContaining({ extract: true, rows: kept }));
  });

  it('listSheets — від сервісу документів для юрософи', async () => {
    const sheets = await service.listSheets(DATE, [], { extract: false, legalEntityId: 'le1' });
    expect(sheets.get('SOLDIERS')).toBe(1);
  });
});

describe('ReportsService.extracts — огляд витягів за ТЦК', () => {
  it('кожен ТЦК з людьми за списками; без ТЦК — останні; останній витяг до ТЦК', async () => {
    staff();
    w.seedEmployee({ lastName: 'Безтецеківський', tckId: null });
    w.db
      .getRepository(OutgoingLetter)
      .qb({ getMany: [{ id: 'l9', number: 'ВО-9', date: '2026-10-01', status: 'SENT', tckId: 't1' }] });
    const list = await service.extracts(DATE, 'le1');
    expect(list.map((x) => x.tckName)).toEqual(['Франківський РТЦК та СП', 'Шевченківський РТЦК та СП', '']);
    const t1 = list.find((x) => x.tckId === 't1')!;
    expect(t1.total).toBe(2);
    expect(t1.lastLetter?.number).toBe('ВО-9');
  });
});

describe('ReportsService.operational — відомість оперативного обліку', () => {
  it('рядок 1 — сума 1.1–1.3; прийняті й звільнені з 2020', async () => {
    staff();
    const { rows } = await service.operational(DATE);
    const [head, ...rest] = rows;
    const subs = rest.slice(0, 3);
    for (const k of ['total', 'reserved', 'other', 'hiredSince2020', 'dismissedSince2020'] as const) {
      expect(head[k]).toBe(subs.reduce((s, r) => s + r[k], 0));
    }
    const all = rows.slice(1);
    expect(all.reduce((s, r) => s + r.total, 0)).toBe(3);
    expect(all.reduce((s, r) => s + r.dismissedSince2020, 0)).toBe(1);
  });

  it('operationalDocx — документ .docx', async () => {
    staff();
    const buffer = await service.operationalDocx(DATE, { number: 'ВО-1', date: DATE }, 'le1');
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});

describe('ReportsService.dashboard — огляд', () => {
  it('працюють, на обліку, черга й прострочені зміни, квота по юрособах', async () => {
    const { a } = staff();
    w.db
      .getRepository(EmployeeChange)
      .seed(
        { employeeId: a.id, type: 'LAST_NAME', effectiveDate: '2026-01-01' } as never,
        { employeeId: a.id, type: 'FIRST_NAME', effectiveDate: DATE } as never,
      );
    const d = await service.dashboard(DATE, 'le1');
    expect(d.employees.employed).toBe(4);
    expect(d.employees.onLists).toBe(4);
    expect(d.pendingChanges).toBe(2);
    expect(d.overdueChanges).toBe(1);
    expect(d.reservation.entities).toHaveLength(1);
    expect(d.organizationConfigured).toBe(true);
  });

  it('чужа юрособа: свої зміни не видно', async () => {
    const { a } = staff();
    w.db.getRepository(EmployeeChange).seed({ employeeId: a.id, type: 'LAST_NAME', effectiveDate: DATE } as never);
    expect((await service.dashboard(DATE, 'le2')).pendingChanges).toBe(0);
  });
});
