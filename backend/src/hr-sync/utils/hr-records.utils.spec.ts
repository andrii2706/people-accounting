import { describe, expect, it } from 'vitest';
import type { Employee } from '../../employees/entities/employee.entity.js';
import type { HrRecord } from '../../shared/interfaces/hr-sync.interface.js';
import { countItems, planBatch, recordsToTable } from './hr-records.utils.js';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.DATABASE_URL ??= 'postgres://test@localhost/test';

// fictional people only
const TCK = { id: '6f2c1f9e-6a2b-4c1d-9a51-1f1d8f3c0a11', name: 'Шевченківський РТЦК та СП м. Львова' };

const employee = (over: Partial<Employee> = {}): Employee =>
  ({
    id: 'e1',
    externalId: '',
    personnelNumber: '0007',
    lastName: 'Приклад',
    firstName: 'Петро',
    middleName: 'Іванович',
    gender: 'M',
    birthDate: '1990-04-15',
    rnokpp: '1111111111',
    rnokppHash: 'h:1111111111',
    phone: '',
    email: '',
    registeredAddress: '',
    actualAddress: '',
    passportType: 'ID_CARD',
    passportSeries: '',
    passportNumber: '',
    passportIssuedBy: '',
    passportIssuedAt: null,
    position: 'інженер',
    department: 'Технічний відділ',
    positionSince: '2024-03-01',
    positions: [
      {
        position: 'інженер',
        department: 'Технічний відділ',
        since: '2024-03-01',
        orderDocName: '',
        orderNumber: '',
        orderDate: null,
      },
    ],
    hireDate: '2024-03-01',
    hireOrderNumber: '',
    hireOrderDate: null,
    dismissalDate: null,
    militaryRegistered: true,
    servedInArmy: false,
    rankCode: null,
    navy: false,
    vos: '',
    registryNumber: '',
    tckId: null,
    fitness: '',
    fitnessDate: null,
    militaryDocuments: [],
    ...over,
  }) as unknown as Employee;

const record = (over: HrRecord = {}): HrRecord => ({
  externalId: 'aaaaaaaa-0000-0000-0000-000000000001',
  personnelNumber: '0007',
  lastName: 'Приклад',
  firstName: 'Петро',
  middleName: 'Іванович',
  birthDate: '15.04.1990',
  rnokpp: '1111111111',
  position: 'інженер',
  department: 'Технічний відділ',
  hireDate: '2024-03-01',
  ...over,
});

const ctx = (employees: Employee[], over = {}) => ({
  employees,
  tcks: [TCK],
  hash: (r: string) => `h:${r}`,
  militaryPolicy: 'FILL_EMPTY' as const,
  importDismissed: false,
  today: '2026-11-18',
  ...over,
});

describe('1C records → our cards', () => {
  it('reads the records with the headers of the import', () => {
    const table = recordsToTable([record()]);
    expect(table.headers).toContain('Прізвище');
    expect(table.rows[0].cells[table.headers.indexOf('Прізвище')]).toBe('Приклад');
  });

  it('a new person → CREATE with the 1C reference', async () => {
    const [item] = await planBatch([record()], ctx([]));
    expect(item.action).toBe('CREATE');
    expect(item.create).toMatchObject({ lastName: 'Приклад', gender: 'M', externalId: record().externalId });
  });

  it('the same data → UNCHANGED, only the link to 1C is kept', async () => {
    const [item] = await planBatch([record()], ctx([employee()]));
    expect(item.action).toBe('UNCHANGED');
    expect(item.employeeId).toBe('e1');
    expect(item.update).toEqual({ externalId: record().externalId });
  });

  it('a new position → UPDATE with a new entry of the positions list from today', async () => {
    const [item] = await planBatch([record({ position: 'старший інженер' })], ctx([employee()]));
    expect(item.action).toBe('UPDATE');
    expect(item.changes.map((c) => c.field)).toEqual(['position']);
    const positions = item.update?.positions as { position: string; since: string }[];
    expect(positions.map((p) => [p.position, p.since])).toEqual([
      ['інженер', '2024-03-01'],
      ['старший інженер', '2026-11-18'],
    ]);
  });

  it('a changed surname is found by the reference and replaced (1C is the source)', async () => {
    const e = employee({ externalId: record().externalId! });
    const [item] = await planBatch([record({ lastName: 'Нове-Прізвище', rnokpp: '' })], ctx([e]));
    expect(item.action).toBe('UPDATE');
    expect(item.changes[0]).toMatchObject({ field: 'lastName', from: 'Приклад', to: 'Нове-Прізвище' });
  });

  it('a dismissal in 1C → DISMISS (the TCK notice is queued by the employees service)', async () => {
    const [item] = await planBatch(
      [record({ dismissalDate: '10.11.2026', dismissalOrderNumber: '12-к' })],
      ctx([employee()]),
    );
    expect(item.action).toBe('DISMISS');
    expect(item.update).toMatchObject({ dismissalDate: '2026-11-10', dismissalOrderNumber: '12-к' });
  });

  it('a person dismissed long ago in 1C is not added', async () => {
    const [item] = await planBatch([record({ dismissalDate: '2020-01-01' })], ctx([]));
    expect(item.action).toBe('SKIP');
  });

  it('military data: fill the empty ones, never overwrite ours unless asked', async () => {
    const military = { rank: 'солдат', vos: '100', tck: TCK.name };
    const ours = employee({ rankCode: 3, vos: '' });
    const [fill] = await planBatch([record({ military })], ctx([ours]));
    expect(fill.changes.map((c) => c.field).sort()).toEqual(['tckId', 'vos']);
    const [over] = await planBatch([record({ military })], ctx([ours], { militaryPolicy: 'OVERWRITE' }));
    expect(over.changes.map((c) => c.field).sort()).toEqual(['rankCode', 'tckId', 'vos']);
    const [ignore] = await planBatch([record({ military })], ctx([ours], { militaryPolicy: 'IGNORE' }));
    expect(ignore.action).toBe('UNCHANGED');
  });

  it('a bad value of 1C is not applied, the rest is', async () => {
    const [item] = await planBatch([record({ position: 'майстер', email: 'not-an-email' })], ctx([employee()]));
    expect(item.action).toBe('UPDATE');
    expect(item.changes.map((c) => c.field)).toEqual(['position']);
    expect(item.messages.join(' ')).toMatch(/Email/);
  });

  it('two records of one person (part-time job): the working one wins', async () => {
    const items = await planBatch(
      [record({ externalId: 'x1', dismissalDate: '2025-01-01' }), record({ externalId: 'x2' })],
      ctx([employee()]),
    );
    expect(items.map((i) => i.action)).toEqual(['SKIP', 'UNCHANGED']);
  });

  it('part-time job: the record already linked to our card wins, even if hired later elsewhere', async () => {
    const items = await planBatch(
      [record({ externalId: 'linked' }), record({ externalId: 'second', hireDate: '2026-11-01' })],
      ctx([employee({ externalId: 'linked' })]),
    );
    expect(items.map((i) => i.action)).toEqual(['UNCHANGED', 'SKIP']);
  });

  it('two different people with one RNOKPP in 1C → both CONFLICT', async () => {
    const items = await planBatch(
      [
        record({ externalId: 'a' }),
        record({ externalId: 'b', lastName: 'Інший', firstName: 'Ігор', birthDate: '1985-05-05' }),
      ],
      ctx([]),
    );
    expect(items.map((i) => i.action)).toEqual(['CONFLICT', 'CONFLICT']);
  });

  it('the RNOKPP of 1C belongs to another of our cards → CONFLICT', async () => {
    const linked = employee({ id: 'e1', externalId: 'ref-1', rnokppHash: 'h:2222222222' });
    const other = employee({ id: 'e2', rnokppHash: 'h:1111111111' });
    const [item] = await planBatch([record({ externalId: 'ref-1' })], ctx([linked, other]));
    expect(item.action).toBe('CONFLICT');
  });

  it('a new person with an invalid value → ERROR, nothing to create', async () => {
    const [item] = await planBatch([record({ birthDate: '31.02.1990' })], ctx([]));
    expect(item.action).toBe('ERROR');
    expect(item.create).toBeUndefined();
  });

  it('counts the actions', () => {
    const counts = countItems([
      { key: '1', action: 'CREATE', fullName: '', personnelNumber: '', employeeId: null, changes: [], messages: [] },
      { key: '2', action: 'UNCHANGED', fullName: '', personnelNumber: '', employeeId: null, changes: [], messages: [] },
    ]);
    expect(counts).toMatchObject({ total: 2, create: 1, unchanged: 1, update: 0 });
  });
});
