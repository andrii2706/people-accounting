import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { HR } from '../../../test/fixtures.js';
import { wire } from '../../../test/wiring.js';
import { Tck } from '../../dictionaries/tck.entity.js';
import { buildListTemplateExample } from '../../documents/builders.js';
import { AuditLog } from '../../employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../../employees/entities/employee-change.entity.js';
import { Employee } from '../../employees/entities/employee.entity.js';
import { LegalEntity } from '../../legal-entities/legal-entity.entity.js';
import type { UploadGuardService } from '../../security/upload-guard.service.js';
import type { StorageService } from '../../storage/storage.service.js';
import { ReportsService } from '../reports.service.js';
import { ListDocumentsService } from './list-documents.service.js';
import { ListSettingsService } from './list-settings.service.js';
import { ListSnapshot } from './list-snapshot.entity.js';
import { ListSnapshotsService } from './list-snapshots.service.js';
import { ListsController } from './lists.controller.js';

const DATE = '2026-11-24';
let w: ReturnType<typeof wire>;
let files: Map<string, Buffer>;
let docs: ListDocumentsService;
let settings: ListSettingsService;
let snapshots: ListSnapshotsService;
let reports: ReportsService;
let c: ListsController;
const journal = () => w.db.getRepository<AuditLog>(AuditLog).rows;

beforeEach(() => {
  w = wire();
  files = new Map();
  const storage = {
    put: async (k: string, b: Buffer) => void files.set(k, b),
    get: async (k: string) => files.get(k)!,
  } as unknown as StorageService;
  docs = new ListDocumentsService(w.db.getRepository(LegalEntity) as never, w.legalEntities, storage);
  settings = new ListSettingsService(w.db.getRepository(LegalEntity) as never, storage);
  reports = new ReportsService(
    w.db.getRepository(Employee) as never,
    w.db.getRepository(EmployeeChange) as never,
    w.db.getRepository(Tck) as never,
    w.org,
    w.legalEntities,
    docs,
  );
  snapshots = new ListSnapshotsService(w.db.getRepository(ListSnapshot) as never, reports, w.legalEntities, w.audit);
  c = new ListsController(snapshots, settings, w.audit, {
    assertSafe: async () => undefined,
  } as unknown as UploadGuardService);
  // fictional people on the lists: two soldiers and a woman
  w.seedEmployee({ lastName: 'Бойко', tckId: 't1' });
  w.seedEmployee({ lastName: 'Антоненко', tckId: 't2' });
  w.seedEmployee({ lastName: 'Вовк', firstName: 'Олена', gender: 'F', rankCode: null, tckId: 't1' });
});

const soldierSettings = async () => (await settings.page('le1')).settings.SOLDIERS;

describe('Сформовані списки', () => {
  it('сформувати: рядки й підсумки за списками; історія; зі знімка — .docx; видалити', async () => {
    const made = await c.form({ date: DATE, legalEntityId: 'le1' } as never, HR, 'le1');
    expect(made.total).toBe(3);
    expect(made.sections.SOLDIERS).toBe(2);
    expect((await c.history('le1')).map((s) => s.id)).toEqual([made.id]);
    const report = await c.snapshot(made.id, 'le1');
    expect(report.rows).toHaveLength(3);
    const file = await c.snapshotDocx(made.id, HR, 'le1');
    expect(file).toBeTruthy();
    await c.snapshotDocx(made.id, HR, 'le1', 'SOLDIERS');
    await expect(c.snapshot(made.id, 'le2')).rejects.toThrow();
    await c.removeSnapshot(made.id, HR, 'le1');
    expect(await c.history('le1')).toEqual([]);
    expect(journal().map((r) => r.action)).toEqual(['CREATE', 'EXPORT', 'EXPORT', 'DELETE']);
  });

  it('кілька юросіб без вибору — історії немає; рядки знімка для листа — лише своєї юрософи', async () => {
    expect(await snapshots.list(null)).toEqual([]);
    const made = await snapshots.create(DATE, 'le1', HR);
    expect((await snapshots.rowsFor(made.id, 'le1')).total).toBe(3);
    await expect(snapshots.rowsFor(made.id, 'le2')).rejects.toThrow();
  });
});

describe('Налаштування списків', () => {
  it('сторінка: колонки за замовчуванням і мітки для власного шаблону', async () => {
    const page = await c.page('le1', 'le1');
    expect(page.settings.SOLDIERS.columns.length).toBeGreaterThan(5);
    expect(page.placeholders.some((p) => p.description.startsWith('у {#rows}'))).toBe(true);
    await expect(Promise.resolve().then(() => c.page('le1', 'le2'))).rejects.toThrow();
  });

  it('збереження розділу: у журналі — які налаштування змінено; невідомий розділ — помилка', async () => {
    const s = await soldierSettings();
    const saved = await c.save(
      'le1',
      'SOLDIERS',
      { ...s, title: 'Список рядового складу', signers: [] } as never,
      HR,
      'le1',
    );
    expect(saved.SOLDIERS.title).toBe('Список рядового складу');
    expect(journal()[0].diff).toHaveProperty('lists.SOLDIERS');
    await expect(Promise.resolve().then(() => c.save('le1', 'BOSSES', s as never, HR, 'le1'))).rejects.toBeTruthy();
  });

  it('власний шаблон Word: завантажити, скачати, прибрати; не .docx чи без файлу — помилка', async () => {
    const s = await soldierSettings();
    const example = await buildListTemplateExample('SOLDIERS', s.columns);
    const upload = {
      buffer: example,
      originalname: Buffer.from('шаблон.docx', 'utf8').toString('latin1'),
      size: example.length,
    };
    const file = upload as never;
    const req = { ip: '10.0.0.1', headers: {}, socket: {} } as never;
    const withTemplate = await c.upload('le1', 'SOLDIERS', file, HR, 'le1', req);
    expect(withTemplate.SOLDIERS.template?.fileName).toBe('шаблон.docx');
    expect([...files.keys()][0]).toMatch(/^list-templates\/le1\/SOLDIERS\/.+\.docx$/);
    expect(await c.template('le1', 'SOLDIERS', 'le1')).toBeTruthy();
    expect(await c.example('le1', 'SOLDIERS', 'le1')).toBeTruthy();

    // the lists document: the soldiers by their own template, the women built in — together in a .zip
    const doc = await docs.render({
      legalEntityId: 'le1',
      date: DATE,
      rows: (await reports.lists(DATE, { legalEntityId: 'le1' })).rows,
      extract: false,
    });
    expect(doc.kind).toBe('zip');
    expect(Object.keys((await JSZip.loadAsync(doc.buffer)).files)).toHaveLength(2);
    const sheets = await docs.sheets({
      legalEntityId: 'le1',
      date: DATE,
      rows: (await reports.lists(DATE, { legalEntityId: 'le1' })).rows,
      extract: false,
    });
    expect(sheets.get('SOLDIERS')).toBeNull();

    const removed = await c.removeTemplate('le1', 'SOLDIERS', HR, 'le1');
    expect(removed.SOLDIERS.template).toBeNull();
    await expect(c.template('le1', 'SOLDIERS', 'le1')).rejects.toThrow('шаблон не завантажено');
    await expect(c.upload('le1', 'SOLDIERS', undefined, HR, 'le1', req)).rejects.toThrow('Оберіть файл');
    await expect(
      c.upload('le1', 'SOLDIERS', { ...upload, originalname: 'x.pdf' } as never, HR, 'le1', req),
    ).rejects.toThrow('.docx');
    await expect(
      c.upload(
        'le1',
        'SOLDIERS',
        { ...upload, buffer: Buffer.from('not word'), originalname: 'x.docx' } as never,
        HR,
        'le1',
        req,
      ),
    ).rejects.toBeTruthy();
  });

  it('вбудований макет: один .docx, аркуші пораховано', async () => {
    const rows = (await reports.lists(DATE, { legalEntityId: 'le1' })).rows;
    const doc = await docs.render({ legalEntityId: 'le1', date: DATE, rows, extract: false });
    expect(doc.kind).toBe('docx');
    const sheets = await docs.sheets({ legalEntityId: 'le1', date: DATE, rows, extract: true });
    expect(sheets.get('SOLDIERS')).toBeGreaterThan(0);
    const one = await docs.render({ legalEntityId: 'le1', date: DATE, rows, extract: false, section: 'WOMEN' });
    expect(one.kind).toBe('docx');
  });
});
