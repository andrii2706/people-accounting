import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { HR } from '../../../test/fixtures.js';
import { wire } from '../../../test/wiring.js';
import { Tck } from '../../dictionaries/tck.entity.js';
import { EmployeeChange } from '../entities/employee-change.entity.js';
import { Employee } from '../entities/employee.entity.js';
import { EmployeeImportService } from './employee-import.service.js';
import { TEMPLATE_COLUMNS } from './import.constants.js';

let w: ReturnType<typeof wire>;
let service: EmployeeImportService;

/** The import checks the TCK as a real id (UUID). */
const T1 = '3f1d2c4b-5a69-4e78-9f01-23456789abcd';

beforeEach(() => {
  w = wire();
  w.db.getRepository(Tck).rows[0].id = T1;
  service = new EmployeeImportService(
    w.db.getRepository(Employee) as never,
    w.db.getRepository(Tck) as never,
    w.employees,
  );
});

/** The template of the service filled in with fictional people — the way HR fills it. */
async function file(rows: Record<string, unknown>[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await service.template()) as never);
  const sheet = wb.getWorksheet('Працівники')!;
  rows.forEach((r, i) => {
    const row = sheet.getRow(i + 2);
    TEMPLATE_COLUMNS.forEach((c, j) => (row.getCell(j + 1).value = (r[c.field] as string) ?? null));
    row.commit();
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const PETRO = {
  personnelNumber: '0007',
  lastName: 'Вигаданий',
  firstName: 'Петро',
  middleName: 'Іванович',
  gender: 'чоловіча',
  birthDate: '15.04.1990',
  position: 'інженер',
  hireDate: '01.03.2024',
  militaryRegistered: 'так',
  rankCode: 'солдат',
  militaryDocType: 'військовий квиток',
  militaryDocNumber: 'АА 123456',
  militaryDocIssuedBy: 'Шевченківським РТЦК та СП',
};

describe('EmployeeImportService.template', () => {
  it('аркуші «Працівники», «Довідка» (з ТЦК довідника) і «Приклад»', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await service.template()) as never);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Працівники', 'Довідка', 'Приклад']);
    const ref = JSON.stringify(wb.getWorksheet('Довідка')!.getSheetValues());
    expect(ref).toContain('Шевченківський РТЦК та СП');
  });
});

describe('EmployeeImportService.preview / check', () => {
  it('рядок з ТЦК за «ким виданий», табельний з нулями, без помилок', async () => {
    const preview = await service.preview(await file([PETRO]), 'працівники.xlsx');
    expect(preview.rows).toHaveLength(1);
    const [row] = preview.rows;
    expect(row.errors).toEqual([]);
    expect(row.fullName).toBe('Вигаданий Петро Іванович');
    expect(row.values.tckId).toBe(T1);
    expect(row.values.personnelNumber).toBe('0007');
    expect(row.duplicate).toBeNull();
  });

  it('уже є в системі (ПІБ + дата народження) — дублікат', async () => {
    w.seedEmployee({ lastName: 'Вигаданий', firstName: 'Петро', middleName: 'Іванович', birthDate: '1990-04-15' });
    const [row] = (await service.preview(await file([PETRO]), 'f.xlsx')).rows;
    expect(row.duplicate).toMatchObject({ by: 'name', fullName: 'Вигаданий Петро Іванович' });
    const other = (await service.preview(await file([PETRO]), 'f.xlsx', 'le2')).rows[0];
    expect(other.duplicate).toBeNull();
  });

  it('файл без колонки прізвища — помилка', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Аркуш').addRow(['Посада', 'Відділ']).commit();
    await expect(service.preview(Buffer.from(await wb.xlsx.writeBuffer()), 'x.xlsx')).rejects.toBeTruthy();
  });

  it('check після правок: ТЦК підтягується з «ким виданий»', async () => {
    const preview = await service.preview(await file([{ ...PETRO, militaryDocIssuedBy: '' }]), 'f.xlsx');
    expect(preview.rows[0].values.tckId ?? null).toBeNull();
    const [checked] = await service.check([
      { ...preview.rows[0], values: { ...preview.rows[0].values, militaryDocIssuedBy: 'Шевченківським РТЦК та СП' } },
    ]);
    expect(checked.values.tckId).toBe(T1);
  });
});

describe('EmployeeImportService.commit', () => {
  it('усе або нічого: створено картки, повідомлення ТЦК за вибором', async () => {
    const preview = await service.preview(
      await file([PETRO, { ...PETRO, lastName: 'Тестовий', personnelNumber: '0008' }]),
      'f.xlsx',
    );
    const out = await service.commit(
      preview.rows,
      { legalEntityId: 'le1', hireNotices: 'ALL', fileName: 'f.xlsx' } as never,
      HR,
    );
    expect(out).toMatchObject({ created: 2, notices: 2 });
    expect(
      w.db
        .getRepository(Employee)
        .rows.map((e) => e.personnelNumber)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['0007', '0008']);
    expect(w.db.getRepository(EmployeeChange).rows.every((c) => c.type === 'HIRE')).toBe(true);
  });

  it('є дублікат чи помилка — нічого не створено, рядки повертаються', async () => {
    const preview = await service.preview(await file([PETRO]), 'f.xlsx');
    w.seedEmployee({ lastName: 'Вигаданий', firstName: 'Петро', middleName: 'Іванович', birthDate: '1990-04-15' });
    await expect(
      service.commit(preview.rows, { legalEntityId: 'le1', hireNotices: 'NONE' } as never, HR),
    ).rejects.toMatchObject({
      response: { rows: [expect.objectContaining({ duplicate: expect.anything() })] },
    });
    expect(w.db.getRepository(Employee).rows).toHaveLength(1);
  });
});
