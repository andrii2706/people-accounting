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
    expect(columnForHeader("Ім'я")?.field).toBe('firstName');
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

  it('men are on military registration by default, an explicit «ні» is kept', () => {
    const { rows } = convertRows(
      {
        headers: ['ПІБ', 'На військовому обліку'],
        rows: [
          { rowNumber: 2, cells: ['Приклад Петро Іванович', ''] },
          { rowNumber: 3, cells: ['Приклад Павло Іванович', 'ні'] },
          { rowNumber: 4, cells: ['Приклад Ганна Іванівна', ''] },
        ],
      },
      ctx,
    );
    expect(rows.map((r) => r.values.militaryRegistered)).toEqual([true, false, undefined]);
  });

  it('«Військовий облік» with a TCK name instead of так/ні: registered, TCK is taken from it', () => {
    const { rows } = convertRows(
      {
        headers: ['ПІБ', 'Військовий облік'],
        rows: [{ rowNumber: 2, cells: ['Приклад Петро Іванович', 'Шевченківський РТЦК та СП м. Львова'] }],
      },
      ctx,
    );
    expect(rows[0].issues).toEqual([]);
    expect(rows[0].values.militaryRegistered).toBe(true);
    expect(rows[0].values.tckId).toBe(ctx.tcks[0].id);
  });

  it('єВОД: no series and number; paper document: number split into series and number', () => {
    const { rows } = convertRows(
      {
        headers: ['ПІБ', 'Військово-обліковий документ', 'Серія ВОД', 'Номер ВОД'],
        rows: [
          { rowNumber: 2, cells: ['Приклад Петро Іванович', 'єВОД', 'АА', '0000000002'] },
          { rowNumber: 3, cells: ['Приклад Павло Іванович', 'військовий квиток', '', 'НО № 000003'] },
          { rowNumber: 4, cells: ['Приклад Іван Іванович', 'військовий квиток АА 123456', '', ''] },
        ],
      },
      ctx,
    );
    const doc = (i: number) => {
      const v = rows[i].values;
      return [v.militaryDocType, v.militaryDocSeries, v.militaryDocNumber];
    };
    expect(doc(0)).toEqual(['військово-обліковий документ в електронній формі', undefined, undefined]);
    expect(doc(1)).toEqual(['військовий квиток', 'НО', '000003']);
    expect(doc(2)).toEqual(['військовий квиток', 'АА', '123456']);
  });

  it('дата наступного ВЛК — лише з відстрочкою', async () => {
    const base = { lastName: 'Приклад', firstName: 'Петро', gender: 'M', nextVlkDate: '2027-01-15' };
    const fields = async (v: Record<string, unknown>) =>
      (await validateValues(v as never)).map((e) => e.field).filter((f) => f === 'nextVlkDate');
    expect(await fields(base)).toEqual(['nextVlkDate']);
    expect(
      await fields({ ...base, deferralMobilizationBasis: 'п. 9 ч. 1 ст. 23', deferralUntil: '2027-02-01' }),
    ).toEqual([]);
  });

  it('converts a row: full name, gender by patronymic, rank, TCK, passport', () => {
    const { rows, mapping } = convertRows(
      {
        headers: ['ПІБ', 'Дата народження', 'Паспорт', 'Звання', 'ТЦК', 'Заброньований', 'Невідома'],
        rows: [
          {
            rowNumber: 5,
            cells: [
              'Приклад Петро Іванович',
              '15.04.1990',
              'КС 123456',
              'старший солдат запасу',
              'Шевченківський РТЦК',
              'ні',
              'x',
            ],
          },
        ],
      },
      ctx,
    );
    expect(mapping.find((m) => m.header === 'Невідома')?.field).toBeNull();
    expect(rows[0].issues).toEqual([]);
    expect(rows[0].values).toMatchObject({
      lastName: 'Приклад',
      firstName: 'Петро',
      middleName: 'Іванович',
      gender: 'M',
      birthDate: '1990-04-15',
      passportType: 'BOOK',
      passportSeries: 'КС',
      passportNumber: '123456',
      rankCode: 3,
      tckId: ctx.tcks[0].id,
      reserved: false,
    });
  });

  it('reports values that cannot be read instead of silently dropping them', () => {
    const { rows } = convertRows(
      {
        headers: ['Прізвище', 'Ім’я', 'Звання', 'Дата народження'],
        rows: [{ rowNumber: 2, cells: ['Тест', 'Олена', 'генералісимус', '40.01.1990'] }],
      },
      ctx,
    );
    expect(rows[0].issues.map((i) => i.field).sort()).toEqual(['birthDate', 'rankCode']);
  });

  it('validates with the rules of the employee form', async () => {
    const errors = await validateValues({
      lastName: 'Тест',
      firstName: 'Олена',
      gender: 'F',
      rnokpp: '123',
      rankCode: 2,
      reserved: true,
    });
    const fields = errors.map((e) => e.field).sort();
    // TCK is not required on import — it stays empty when it is not in the directory
    expect(fields).toEqual(['reservationUntil', 'rnokpp']);
    expect(await validateValues({ lastName: 'Тест', firstName: 'Олена', gender: 'F' })).toEqual([]);
  });

  it('takes the TCK from «Ким виданий ВОД»; unknown TCK — empty, without an error', () => {
    const tcks = {
      tcks: [
        { id: 'a', name: 'Личаківсько-Залізничний ОРТЦК та СП (м. Львів)' },
        { id: 'b', name: 'Сихівський РТЦК та СП (м. Львів)' },
      ],
    };
    const headers = ['Прізвище', 'Ім’я', 'Ким виданий ВОД', 'ТЦК та СП'];
    const { rows } = convertRows(
      {
        headers,
        rows: [
          { rowNumber: 2, cells: ['Тест', 'Іван', 'Личаківсько-Залізничний ОР у місті Львові ТЦК та СП', ''] },
          { rowNumber: 3, cells: ['Тест', 'Петро', '', 'Сихівський районний у місті Львові ТЦК та СП'] },
          { rowNumber: 4, cells: ['Тест', 'Олег', 'Невідомий РВК', 'Невідомий ТЦК'] },
        ],
      },
      tcks,
    );
    expect(rows.map((r) => r.values.tckId)).toEqual(['a', 'b', undefined]);
    expect(rows[2].issues).toEqual([]);
  });

  it('parses CSV with quotes and semicolons', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\n1;2;3', ';')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });
});
