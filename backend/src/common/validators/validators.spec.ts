import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateLegalEntityDto } from '../../legal-entities/legal-entities.dto.js';
import { CreateEmployeeDto } from '../../employees/employees.dto.js';
import { fieldLabel } from '../utils/field-labels.utils.js';
import { HttpExceptionFilter } from '../filters/http-exception.filter.js';
import { validationExceptionFactory } from './validators.js';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.DATABASE_URL ??= 'postgres://test@localhost/test';

const messages = async (cls: new () => object, body: object) => {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: true, value: false },
  });
  const res = validationExceptionFactory(errors).getResponse() as { message: string[]; errors: { field: string }[] };
  return res;
};

describe('повідомлення про помилки — людською мовою', () => {
  it('назви полів залежать від запиту, а не беруться з коду', () => {
    expect(fieldLabel('fullName', 'CreateLegalEntityDto')).toBe('Повна назва');
    expect(fieldLabel('fullName', 'CreateUserDto')).toBe('ПІБ');
    expect(fieldLabel('militaryDocuments.0.number')).toBe('Військово-обліковий документ 1 — Номер');
    expect(fieldLabel('positions.1')).toBe('Посада 2');
  });

  it('реквізити: зайві службові поля і поганий індекс — зрозуміло', async () => {
    const res = await messages(CreateLegalEntityDto, {
      id: 1,
      fullName: 'ТОВ «Приклад»',
      edrpou: '12345678',
      postalCode: '790',
      phone: '067 000 00 00',
    });
    expect(res.errors.map((e) => e.field).sort()).toEqual(['id', 'postalCode']);
    expect(res.message).toContain('Поштовий індекс: Поштовий індекс — 5 цифр, напр. 79000');
    expect(res.message.find((m) => m.startsWith('Службове поле «id»:'))).toContain('оновіть сторінку');
  });

  it('телефон у будь-якому написанні зберігається як код країни + цифри', async () => {
    const dto = plainToInstance(CreateLegalEntityDto, { fullName: 'ТОВ', edrpou: '12345678', phone: '067 000 00 00' });
    expect(dto.phone).toBe('+380670000000');
    const bad = await messages(CreateLegalEntityDto, { fullName: 'ТОВ', edrpou: '12345678', phone: '+38 (0' });
    expect(bad.errors.map((e) => e.field)).toEqual(['phone']);
  });

  it('стандартні англійські тексти перекладаються з числами', async () => {
    const res = await messages(CreateEmployeeDto, {
      lastName: 'Я'.repeat(150),
      firstName: 'Петро',
      gender: 'M',
      militaryDocuments: [{ number: '№1' }],
    });
    expect(res.message.join('\n')).not.toMatch(/must|should|shorter/);
    expect(res.message.some((m) => m.startsWith('Прізвище:'))).toBe(true);
    expect(res.message.some((m) => m.startsWith('Військово-обліковий документ 1 — Номер:'))).toBe(true);
  });
});

describe('HttpExceptionFilter', () => {
  const run = (ex: HttpException) => {
    let sent: { status?: number; body?: Record<string, unknown> } = {};
    const res = {
      status: (s: number) => ({ json: (b: Record<string, unknown>) => (sent = { status: s, body: b }) }),
    };
    new HttpExceptionFilter().catch(ex, {
      switchToHttp: () => ({ getResponse: () => res }),
    } as never);
    return sent;
  };

  it('англійські тексти за замовчуванням → українські', () => {
    expect(run(new NotFoundException()).body?.['message']).toBe('Запис не знайдено — можливо, його вже видалили');
    expect(run(new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS)).body?.['message']).toBe(
      'Забагато спроб — зачекайте хвилину',
    );
  });

  it('українські повідомлення і поля errors / code не чіпає', () => {
    const body = { message: ['Телефон: Некоректний формат'], errors: [{ field: 'phone', message: 'x' }], code: 'X' };
    const sent = run(new BadRequestException(body));
    expect(sent.body).toMatchObject({ ...body, statusCode: 400 });
  });
});

describe('паролі та email користувачів', () => {
  it('пояснює, чого бракує паролю, без дубля назви поля', async () => {
    const { CreateUserDto } = await import('../../users/users.dto.js');
    const res = await messages(CreateUserDto, { email: 'hr@company', password: 'abc', fullName: 'Петро' });
    expect(res.message).toContain('Email: Некоректний email — приклад: name@company.ua');
    expect(res.message).toContain('Пароль: Потрібно: щонайменше 12 символів, хоча б одна цифра');
  });
});
