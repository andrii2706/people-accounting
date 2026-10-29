import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth.js';
import { blindIndex } from '../../common/crypto/field-encryption.js';
import type { FieldError } from '../../common/validators.js';
import { Tck } from '../../dictionaries/tck.entity.js';
import { FITNESS_STATUSES, MILITARY_DOCUMENT_TYPES } from '../../military/dictionaries.js';
import { RANKS } from '../../military/ranks.js';
import type { CreateEmployeeDto } from '../employees.dto.js';
import { EmployeesService } from '../employees.service.js';
import { Employee } from '../entities/employee.entity.js';
import { TEMPLATE_COLUMNS } from './import-columns.js';
import { readTable } from './import-reader.js';
import { type ColumnMapping, convertRows, fullNameOf, type ImportRow, type ImportValues, toDtoValues, validateValues } from './import-rows.js';

export interface CheckedRow extends ImportRow {
  fullName: string;
  /** Read issues + validation errors. A row with errors cannot be imported. */
  errors: FieldError[];
  /** The employee is already in the system (by RNOKPP or full name + date of birth) — skipped. */
  duplicate: { id: string; fullName: string; by: 'rnokpp' | 'name' } | null;
}

export interface ImportPreview {
  fileName?: string;
  mapping: ColumnMapping[];
  rows: CheckedRow[];
}

@Injectable()
export class EmployeeImportService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(Tck) private readonly tcks: Repository<Tck>,
    private readonly employeesService: EmployeesService,
  ) {}

  /** Reads the file and checks every row. Nothing is saved. */
  async preview(buffer: Buffer, fileName: string): Promise<ImportPreview> {
    const table = await readTable(buffer, fileName);
    const tcks = await this.tcks.find({ select: { id: true, name: true } });
    const { mapping, rows } = convertRows(table, { tcks });
    if (!mapping.some((m) => m.field === 'lastName' || m.field === 'fullName')) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['У файлі немає колонки «Прізвище» або «ПІБ»'] });
    }
    return { fileName, mapping, rows: await this.check(rows) };
  }

  /** Checks the rows again after the user edited them on the preview page. */
  async check(rows: ImportRow[]): Promise<CheckedRow[]> {
    const existing = await this.existingIndex(rows.map((r) => r.values));
    const seenRnokpp = new Map<string, number>();
    const checked: CheckedRow[] = [];
    for (const row of rows) {
      const errors = [...row.issues];
      for (const e of await validateValues(row.values)) {
        if (!errors.some((x) => x.field === e.field)) errors.push(e);
      }
      const rnokpp = String(row.values.rnokpp ?? '');
      if (rnokpp) {
        const first = seenRnokpp.get(rnokpp);
        if (first !== undefined) errors.push({ field: 'rnokpp', message: `Такий самий РНОКПП у рядку ${first}` });
        else seenRnokpp.set(rnokpp, row.rowNumber);
      }
      checked.push({ ...row, fullName: fullNameOf(row.values), errors, duplicate: existing(row.values) });
    }
    return checked;
  }

  /** Creates the employees from the rows that passed the check — all or nothing. */
  async commit(rows: ImportRow[], opts: { hireNotices: boolean; fileName?: string }, user: AuthUser) {
    const checked = await this.check(rows);
    const bad = checked.filter((r) => r.errors.length || r.duplicate);
    if (bad.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [`Дані змінилися або містять помилки (${bad.length} рядк.). Перевірте ще раз.`],
        rows: checked,
      });
    }
    const source = `імпорт з файлу${opts.fileName ? ` «${opts.fileName}»` : ''}`;
    const ids = await this.employeesService.createMany(
      checked.map((r) => toDtoValues(r.values) as unknown as CreateEmployeeDto),
      user,
      { hireNotices: opts.hireNotices, source },
    );
    return { created: ids.length, ids };
  }

  /** Lookup of employees that already exist: by RNOKPP (blind index) or full name + date of birth. */
  private async existingIndex(values: ImportValues[]) {
    const hashes = values.map((v) => blindIndex(String(v.rnokpp ?? ''))).filter((h): h is string => !!h);
    const lastNames = [...new Set(values.map((v) => String(v.lastName ?? '')).filter(Boolean))];
    const [byHash, byName] = await Promise.all([
      hashes.length ? this.employees.find({ loadEagerRelations: false, where: { rnokppHash: In(hashes) }, select: { id: true, lastName: true, firstName: true, middleName: true, rnokppHash: true } }) : [],
      lastNames.length ? this.employees.find({ loadEagerRelations: false, where: { lastName: In(lastNames) }, select: { id: true, lastName: true, firstName: true, middleName: true, birthDate: true } }) : [],
    ]);
    const name = (e: Employee) => `${e.lastName} ${e.firstName} ${e.middleName}`.trim();
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
    return (v: ImportValues): CheckedRow['duplicate'] => {
      const hash = blindIndex(String(v.rnokpp ?? ''));
      const sameRnokpp = hash ? byHash.find((e) => e.rnokppHash === hash) : undefined;
      if (sameRnokpp) return { id: sameRnokpp.id, fullName: name(sameRnokpp), by: 'rnokpp' };
      const sameName = byName.find(
        (e) =>
          norm(e.lastName) === norm(v.lastName) &&
          norm(e.firstName) === norm(v.firstName) &&
          norm(e.middleName) === norm(v.middleName) &&
          !!v.birthDate &&
          e.birthDate === v.birthDate,
      );
      return sameName ? { id: sameName.id, fullName: name(sameName), by: 'name' } : null;
    };
  }

  /** Import template: sheet «Працівники» (headers only), «Довідка» (allowed values) and «Приклад». */
  async template(): Promise<Buffer> {
    const tcks = await this.tcks.find({ where: { isActive: true }, order: { name: 'ASC' } });
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Військовий облік';

    const sheet = wb.addWorksheet('Працівники', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.field, width: c.width ?? 16 }));
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.alignment = { wrapText: true, vertical: 'middle' };
    header.height = 32;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECE3' } };
    TEMPLATE_COLUMNS.forEach((c, i) => {
      if (c.note) sheet.getCell(1, i + 1).note = c.note;
    });

    // allowed values — on a separate sheet, referenced by drop-down lists
    const ref = wb.addWorksheet('Довідка');
    const lists: Record<string, string[]> = {
      'Стать': ['чоловіча', 'жіноча'],
      'Так / ні': ['так', 'ні'],
      'Тип паспорта': ['ID-картка', 'книжечка'],
      'Військове звання': [...new Set(RANKS.flatMap((r) => [r.army, r.navy]))],
      'Військово-обліковий документ': [...MILITARY_DOCUMENT_TYPES],
      'Придатність': [...FITNESS_STATUSES],
      'ТЦК та СП': tcks.map((t) => t.name),
    };
    const ranges: Record<string, string> = {};
    Object.entries(lists).forEach(([title, items], i) => {
      const col = ref.getColumn(i + 1);
      col.width = title === 'ТЦК та СП' || title === 'Придатність' ? 48 : 30;
      ref.getCell(1, i + 1).value = title;
      ref.getCell(1, i + 1).font = { bold: true };
      items.forEach((item, j) => (ref.getCell(j + 2, i + 1).value = item));
      const letter = col.letter;
      ranges[title] = `'Довідка'!$${letter}$2:$${letter}$${Math.max(items.length + 1, 2)}`;
    });
    ref.getCell(1, Object.keys(lists).length + 2).value = 'Дати — ДД.ММ.РРРР. РНОКПП — 10 цифр. Паспорт-книжечка: серія (2 літери) + номер (6 цифр); ID-картка: номер 9 цифр, «ким виданий» — 4-значний код.';

    const listFor: Record<string, string> = {
      gender: 'Стать',
      militaryRegistered: 'Так / ні',
      reserved: 'Так / ні',
      servedInArmy: 'Так / ні',
      passportType: 'Тип паспорта',
      rankCode: 'Військове звання',
      militaryDocType: 'Військово-обліковий документ',
      fitness: 'Придатність',
      tckId: 'ТЦК та СП',
    };
    TEMPLATE_COLUMNS.forEach((c, i) => {
      const list = listFor[c.field];
      const letter = sheet.getColumn(i + 1).letter;
      for (let r = 2; r <= 501; r++) {
        const cell = sheet.getCell(`${letter}${r}`);
        if (list) cell.dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: [ranges[list]] };
        if (c.kind === 'date') cell.numFmt = 'dd.mm.yyyy';
        if (c.kind === 'digits' || c.field === 'vos' || c.field === 'registryNumber' || c.field === 'personnelNumber') cell.numFmt = '@';
      }
    });

    // a fictitious example on its own sheet, so it is never imported by accident
    const example = wb.addWorksheet('Приклад');
    example.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.field, width: c.width ?? 16 }));
    example.getRow(1).font = { bold: true };
    example.addRow({
      personnelNumber: '0001', lastName: 'Приклад', firstName: 'Петро', middleName: 'Іванович', gender: 'чоловіча',
      birthDate: '15.04.1990', rnokpp: '1234567890', phone: '+380 67 000 00 00', registeredAddress: 'м. Львів, вул. Прикладна, 1',
      passportType: 'ID-картка', passportNumber: '000000001', passportIssuedBy: '4610', passportIssuedAt: '01.02.2020',
      position: 'інженер', department: 'Технічний відділ', hireDate: '01.03.2024', hireOrderNumber: '15-к', hireOrderDate: '28.02.2024',
      militaryRegistered: 'так', servedInArmy: 'ні', rankCode: 'солдат', vos: '100', militaryDocType: 'військово-обліковий документ в електронній формі',
      militaryDocNumber: '000000000', tckId: tcks[0]?.name ?? '', fitness: 'придатний до військової служби', reserved: 'ні',
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
