import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, HR } from '../../test/fixtures.js';
import { wire } from '../../test/wiring.js';
import { EmployeeChange } from './entities/employee-change.entity.js';
import { Employee } from './entities/employee.entity.js';
import { EmployeesController } from './employees.controller.js';

let w: ReturnType<typeof wire>;
let controller: EmployeesController;

beforeEach(() => {
  w = wire();
  controller = new EmployeesController(w.employees);
  const repo = w.db.getRepository<Employee>(Employee);
  // the list query (a query builder) — the rows of the fake database with relations loaded
  repo.qb({ getMany: () => repo.rows.map((r) => repo.hydrate({ ...r })) });
});

describe('EmployeesController: межі юрософи', () => {
  it('list: кадровик бачить лише свою юрособу, навіть якщо просить іншу', async () => {
    w.seedEmployee({ lastName: 'Свій' });
    const query = { legalEntityId: 'le2' } as never;
    expect(() => controller.list(query, 'le1')).toThrow('Юридичну особу не знайдено');
    const own = await controller.list({} as never, 'le1');
    expect(own.items.map((i) => i.lastName)).toEqual(['Свій']);
  });

  it('get / audit / update / dismiss / remove: чужий працівник — «не знайдено»', async () => {
    const e = w.seedEmployee({ legalEntityId: 'le2' });
    await expect(controller.get(e.id, HR, 'le1')).rejects.toThrow('Працівника не знайдено');
    await expect(controller.audit(e.id, 'le1')).rejects.toThrow('Працівника не знайдено');
    await expect(controller.update(e.id, { phone: '1' } as never, HR, 'le1')).rejects.toThrow('Працівника не знайдено');
    await expect(controller.dismiss(e.id, { dismissalDate: '2026-11-24' } as never, HR, 'le1')).rejects.toThrow(
      'Працівника не знайдено',
    );
    await expect(controller.remove(e.id, HR, 'le1')).rejects.toThrow('Працівника не знайдено');
    expect((await controller.get(e.id, ADMIN, null)).id).toBe(e.id);
  });

  it('create: нова картка — у юрособі користувача', async () => {
    expect(() =>
      controller.create({ lastName: 'Новий', firstName: 'Тест', legalEntityId: 'le2' } as never, HR, 'le1'),
    ).toThrow('Юридичну особу не знайдено');
    const ok = await controller.create(
      { lastName: 'Новий', firstName: 'Тест', middleName: '', gender: 'M' } as never,
      HR,
      'le1',
    );
    expect(ok.legalEntityId).toBe('le1');
  });
});

describe('EmployeesController: звільнені у .xlsx', () => {
  it('файл з наказом і станом повідомлення ТЦК', async () => {
    const e = w.seedEmployee({
      lastName: 'Звільнений',
      dismissalDate: '2026-10-01',
      dismissalOrderNumber: '12-к',
      dismissalOrderDate: '2026-09-30',
    });
    w.seedEmployee({ lastName: 'Працює' });
    w.db
      .getRepository(EmployeeChange)
      .seed({ employeeId: e.id, type: 'DISMISSAL', effectiveDate: '2026-10-01' } as never);
    // the SQL filter of the list (status «dismissed») — as the database would apply it
    const repo = w.db.getRepository<Employee>(Employee);
    repo.qb({ getMany: () => repo.rows.filter((r) => r.dismissalDate).map((r) => repo.hydrate({ ...r })) });
    const file = await controller.dismissedXlsx({} as never, 'le1');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.getStream().read() ?? (await streamToBuffer(file.getStream())));
    const text = JSON.stringify(wb.worksheets[0].getSheetValues());
    expect(text).toContain('Звільнений');
    expect(text).toContain('№ 12-к від 30.09.2026');
    expect(text).not.toContain('Працює');
  });
});

describe('EmployeesController: черга змін і ТЦК', () => {
  it('pending / updateChange / tckMatches / assignTck — у межах юрософи', async () => {
    const e = w.seedEmployee({
      militaryDocuments: [
        { type: 'Військовий квиток', number: '1', issuedBy: 'Шевченківським РТЦК та СП', sortOrder: 0 },
      ],
    });
    const [c] = w.db
      .getRepository(EmployeeChange)
      .seed({ employeeId: e.id, type: 'LAST_NAME', effectiveDate: '2026-11-01' } as never);
    expect(await controller.pending('le1')).toHaveLength(1);
    expect((await controller.updateChange(c.id, { basis: 'заява' } as never, 'le1')).basis).toBe('заява');
    expect(await controller.tckMatches('t1', 'le1')).toHaveLength(1);
    expect(await controller.assignTck({ tckId: 't1', employeeIds: [e.id] } as never, HR, 'le1')).toEqual({
      assigned: 1,
    });
  });
});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c as Buffer));
  return Buffer.concat(chunks);
}
