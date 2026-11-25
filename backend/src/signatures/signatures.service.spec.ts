import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN } from '../../test/fixtures.js';
import { FakeDb } from '../../test/fake-db.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { LetterSignature } from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import type { LettersService } from '../letters/letters.service.js';
import type { UploadGuardService } from '../security/upload-guard.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { SignaturesService } from './signatures.service.js';

let db: FakeDb;
let files: Map<string, Buffer>;
let letters: { document: ReturnType<typeof vi.fn>; frozenDocument: ReturnType<typeof vi.fn> };
let service: SignaturesService;
const repo = () => db.getRepository<OutgoingLetter>(OutgoingLetter);

beforeEach(() => {
  db = new FakeDb();
  files = new Map();
  repo().seed({
    id: 'l1',
    year: 2026,
    sequence: 1,
    number: 'ВО-1',
    date: '2026-11-24',
    type: 'CHANGE_NOTICE',
    status: 'DRAFT',
    params: {},
  } as never);
  repo().qb({ getOne: () => repo().rows[0] });
  letters = {
    document: vi.fn(async () => ({ buffer: Buffer.from('docx-bytes'), filename: 'Повідомлення ВО-1 Вигаданий.docx' })),
    frozenDocument: vi.fn(),
  };
  const storage = {
    exists: async (k: string) => files.has(k),
    put: async (k: string, b: Buffer) => void files.set(k, b),
  } as unknown as StorageService;
  service = new SignaturesService(
    repo() as never,
    db.getRepository(LetterSignature) as never,
    db.dataSource as never,
    letters as unknown as LettersService,
    storage,
    new AuditService(db.getRepository(AuditLog) as never),
    { assertSafe: vi.fn() } as unknown as UploadGuardService,
  );
});

describe('SignaturesService: фіксація документа для підпису', () => {
  it('freeze: файл збережено один раз, SHA-256 у листі, журнал; вдруге — той самий стан', async () => {
    const state = await service.freeze('l1', ADMIN);
    expect(state.frozen).toBe(true);
    expect(state.documentSha256).toHaveLength(64);
    expect([...files.keys()]).toEqual([expect.stringMatching(/^letters\/2026\/l1\/document-[0-9a-f]{16}\.docx$/)]);
    expect(db.getRepository(AuditLog).rows).toHaveLength(1);
    await service.freeze('l1', ADMIN);
    expect(letters.document).toHaveBeenCalledTimes(1);
  });

  it('unfreeze: лише без підписів і не надісланий', async () => {
    await service.freeze('l1', ADMIN);
    db.getRepository(LetterSignature).seed({
      letterId: 'l1',
      fileKey: 'k',
      documentSha256: 'x',
      fileSha256: 'y',
    } as never);
    await expect(service.unfreeze('l1', ADMIN)).rejects.toThrow('уже підписано');
    db.getRepository(LetterSignature).rows.length = 0;
    const state = await service.unfreeze('l1', ADMIN);
    expect(state.frozen).toBe(false);
    expect((await service.unfreeze('l1', ADMIN)).frozen).toBe(false);
    await service.freeze('l1', ADMIN);
    repo().rows[0].status = 'SENT';
    await expect(service.unfreeze('l1', ADMIN)).rejects.toThrow('уже надіслано');
  });

  it('стан без ключів файлів; невідомий лист — «не знайдено»; налаштування віджета', async () => {
    db.getRepository(LetterSignature).seed({
      letterId: 'l1',
      fileKey: 'secret-key',
      documentSha256: 'x',
      fileSha256: 'y',
      signerName: 'Вигаданий',
    } as never);
    const state = await service.state('l1');
    expect(state.signatures[0]).not.toHaveProperty('fileKey');
    await expect(service.state('nope')).rejects.toThrow('Лист не знайдено');
    expect(service.config().widget).toHaveProperty('enabled');
  });

  it('add: порожній файл підпису — помилка', async () => {
    letters.frozenDocument.mockResolvedValue({ letter: repo().rows[0], buffer: Buffer.from('doc') });
    await expect(service.add('l1', '', 'FILE' as never, ADMIN)).rejects.toThrow('Порожній файл підпису');
  });
});
