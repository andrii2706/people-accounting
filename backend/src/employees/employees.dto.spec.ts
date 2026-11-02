import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { flattenValidationErrors } from '../common/validators.js';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employees.dto.js';
import { MESSAGE, normalizeVos } from '../military/employee-rules.js';

async function errorsOf(cls: new () => object, payload: Record<string, unknown>) {
  const dto = plainToInstance(cls, payload);
  return flattenValidationErrors(await validate(dto, { whitelist: true, forbidNonWhitelisted: true }));
}

const valid = {
  gender: 'M',
  lastName: 'Шевченко',
  firstName: 'Тарас',
  middleName: 'Григорович',
  rnokpp: '1234567890',
  passportType: 'ID_CARD',
  passportNumber: '123456789',
  passportIssuedBy: '4610',
  rankCode: 2,
  vos: '837',
  accountingCategory: '1',
};

describe('валідація картки працівника', () => {
  it('приймає коректні дані', async () => {
    expect(await errorsOf(CreateEmployeeDto, valid)).toEqual([]);
  });

  it('прив’язує помилки до полів українською', async () => {
    const errors = await errorsOf(CreateEmployeeDto, { ...valid, lastName: '', rnokpp: '12', email: 'not-an-email' });
    expect(errors).toEqual(
      expect.arrayContaining([
        { field: 'lastName', message: 'Вкажіть прізвище' },
        { field: 'rnokpp', message: 'РНОКПП — рівно 10 цифр' },
        { field: 'email', message: 'Некоректний email' },
      ]),
    );
  });

  it('перевіряє паспорт залежно від типу', async () => {
    const id = await errorsOf(CreateEmployeeDto, { ...valid, passportSeries: 'КС', passportNumber: '123456' });
    expect(id.map((e) => e.field)).toEqual(expect.arrayContaining(['passportSeries', 'passportNumber']));

    const book = await errorsOf(CreateEmployeeDto, {
      ...valid,
      passportType: 'BOOK',
      passportSeries: 'КС',
      passportNumber: '123456',
      passportIssuedBy: 'Шевченківським РВ',
    });
    expect(book).toEqual([]);

    const longSeries = await errorsOf(CreateEmployeeDto, {
      ...valid,
      passportType: 'BOOK',
      passportSeries: 'ABCDEFGHIJKL',
      passportNumber: '123456',
    });
    expect(longSeries).toContainEqual({ field: 'passportSeries', message: 'Не більше 2 символів' });
  });

  it('ВОС: офіцери — 6 цифр, інші — 3 або 6, можна з літерою в кінці', async () => {
    const messages = async (rankCode: number, vos: string) =>
      (await errorsOf(CreateEmployeeDto, { ...valid, rankCode, vos })).map((e) => e.message);
    expect(await messages(14, '837')).toContain(MESSAGE.vosOfficer);
    expect(await messages(14, '21101')).toContain(MESSAGE.vosOfficer);
    for (const vos of ['021101', '021101А', '021-101']) expect(await messages(14, vos)).toEqual([]);
    for (const vos of ['100', '837А', '100915', '100-915', '100915А']) expect(await messages(2, vos)).toEqual([]);
    for (const vos of ['10', '1000', 'ABC']) expect(await messages(2, vos)).toContain(MESSAGE.vosOther);
    expect(normalizeVos('021-101 а')).toBe('021101А');
  });

  it('дати: не в майбутньому, порядок дат', async () => {
    const errors = await errorsOf(CreateEmployeeDto, {
      ...valid,
      birthDate: '2999-01-01',
      mobilizedAt: '2025-05-01',
      demobilizedAt: '2025-01-01',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        { field: 'birthDate', message: 'Дата не може бути в майбутньому' },
        { field: 'demobilizedAt', message: 'Раніше за дату мобілізації' },
      ]),
    );
  });

  it('члени сім’ї: шлях до вкладеного поля', async () => {
    const errors = await errorsOf(UpdateEmployeeDto, {
      familyMembers: [{ relation: 'WIFE', lastName: 'Іваненко', firstName: '' }],
    });
    expect(errors).toContainEqual({ field: 'familyMembers.0.firstName', message: 'Вкажіть ім’я' });
  });

  it('невідомі поля відхиляються', async () => {
    const errors = await errorsOf(CreateEmployeeDto, { ...valid, hack: 1 });
    expect(errors).toContainEqual({ field: 'hack', message: 'Невідоме поле' });
  });
});
