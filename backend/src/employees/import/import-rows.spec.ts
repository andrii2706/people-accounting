import { describe, expect, it } from 'vitest';
import { columnForHeader } from './import-columns.js';
import { parseCsv } from './import-reader.js';
import { convertRows, parseDate, validateValues } from './import-rows.js';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.DATABASE_URL ??= 'postgres://test@localhost/test';

const ctx = { tcks: [{ id: '6f2c1f9e-6a2b-4c1d-9a51-1f1d8f3c0a11', name: 'Шевченківський РТЦК та СП м. Львова' }] };

describe('employee import — reading values', () => {
  it('recognizes headers from 1C and the template', () => {
    expect(columnForHeader('Ідентифікаційний код')?.field).toBe('rnokpp');
    expect(columnForHeader('Таб. №')?.field).toBe('personnelNumber');
    expect(columnForHeader('Ім\'я')?.field).toBe('firstName');
    expect(columnForHeader('Дата прийому')?.field).toBe('hireDate');
    expect(columnForHeader('Якась колонка')).toBeUndefined();
  });

  it('parses dates in the usual formats', () => {
    expect(parseDate('05.03.1990')).toBe('1990-03-05');
    expect(parseDate('5/3/1990')).toBe('1990-03-05');
    expect(parseDate('1990-03-05')).toBe('1990-03-05');
    expect(parseDate('05.03.1990 р.')).toBe('1990-03-05');
    expect(parseDate(32937)).toBe('1990-03-05'); // Excel serial number
    expect(parseDate(new Date(Date.UTC(1990, 2, 5)))).toBe('1990-03-05');
    expect(parseDate('31.02.1990')).toBeUndefined();
    expect(parseDate('')).toBeNull();
  });

  it('converts a row: full name, gender by patronymic, rank, TCK, passport', () => {
    const { rows, mapping } = convertRows(
      {
        headers: ['ПІБ', 'Дата народження', 'Паспорт', 'Звання', 'ТЦК', 'Заброньований', 'Невідома'],
        rows: [{ rowNumber: 5, cells: ['Приклад Петро Іванович', '15.04.1990', 'КС 123456', 'старший солдат запасу', 'Шевченківський РТЦК', 'ні', 'x'] }],
      },
      ctx,
    );
    expect(mapping.find((m) => m.header === 'Невідома')?.field).toBeNull();
    expect(rows[0].issues).toEqual([]);
    expect(rows[0].values).toMatchObject({
      lastName: 'Приклад', firstName: 'Петро', middleName: 'Іванович', gender: 'M', birthDate: '1990-04-15',
      passportType: 'BOOK', passportSeries: 'КС', passportNumber: '123456', rankCode: 3, tckId: ctx.tcks[0].id, reserved: false,
    });
  });

  it('reports values that cannot be read instead of silently dropping them', () => {
    const { rows } = convertRows({ headers: ['Прізвище', 'Ім’я', 'Звання', 'Дата народження'], rows: [{ rowNumber: 2, cells: ['Тест', 'Олена', 'генералісимус', '40.01.1990'] }] }, ctx);
    expect(rows[0].issues.map((i) => i.field).sort()).toEqual(['birthDate', 'rankCode']);
  });

  it('validates with the rules of the employee form', async () => {
    const errors = await validateValues({ lastName: 'Тест', firstName: 'Олена', gender: 'F', rnokpp: '123', rankCode: 2, reserved: true });
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(['reservationUntil', 'rnokpp', 'tckId']);
    expect(await validateValues({ lastName: 'Тест', firstName: 'Олена', gender: 'F' })).toEqual([]);
  });

  it('parses CSV with quotes and semicolons', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\n1;2;3', ';')).toEqual([['a', 'b;c', 'd "e"'], ['1', '2', '3']]);
  });
});
