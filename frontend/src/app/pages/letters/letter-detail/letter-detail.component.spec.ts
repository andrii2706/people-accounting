import type { LetterDetails } from '../../../shared/interfaces/letter.interface';
import { FileDownloadService } from '../../../shared/services/file-download.service';
import { LettersService } from '../../../shared/services/letters.service';
import { SignaturesService } from '../../../shared/services/signatures.service';
import { TCK_A } from '../../../testing/fixtures.testing';
import { renderPage } from '../../../testing/page.testing';
import { LetterDetailComponent } from './letter-detail.component';

/** An outgoing letter about a fictional person. */
const LETTER = (over: Partial<LetterDetails> = {}): LetterDetails => ({
  id: 'l1',
  year: 2026,
  sequence: 15,
  number: '15',
  date: '2026-11-20',
  type: 'CHANGE_NOTICE',
  subject: 'Про зміну даних',
  employeeId: 'e1',
  employee: { id: 'e1', fullName: 'Вигаданий Петро' },
  tckId: 't1',
  tck: TCK_A as never,
  params: {},
  status: 'DRAFT',
  external: false,
  legalEntityId: 'le1',
  sentAt: null,
  frozen: false,
  documentSha256: null,
  createdAt: '2026-11-20T09:00:00Z',
  notices: [
    {
      id: 'n1',
      letterId: 'l1',
      sequence: 1,
      number: '15',
      employeeId: 'e1',
      employeeName: 'Вигаданий Петро',
      changeType: 'POSITION',
      typeLabel: 'Зміна даних',
      effectiveDate: '2026-11-19',
      createdAt: '',
    },
  ],
  changes: [
    {
      id: 'c1',
      type: 'POSITION',
      newValue: 'нове значення',
      effectiveDate: '2026-11-19',
      basis: 'наказ 1',
    },
  ],
  signatureCount: 0,
  ...over,
});
const SIGNING = {
  frozen: false,
  documentSha256: null,
  documentFilename: null,
  documentFrozenAt: null,
  signatures: [],
};
const CONFIG = { widget: { enabled: false, scriptUrl: '', frameUrl: '' }, verifyUrl: '' };

type State = {
  typeLabel: () => string;
  signed: () => boolean;
  tckOptions: () => { value: string }[];
  number: { set: (v: string) => void };
  date: { set: (v: string) => void };
  saveMeta: () => Promise<void>;
  changeTck: (id: string) => Promise<void>;
  refreshPage: () => void;
  markSent: () => Promise<void>;
  remove: () => Promise<void>;
};

function render(opts: { confirm?: boolean; letter?: Partial<LetterDetails> } = {}) {
  const letters = {
    update: vi.fn(async () => ({})),
    markSent: vi.fn(async () => ({})),
    remove: vi.fn(async () => undefined),
    docxUrl: (id: string) => `api/letters/${id}/docx`,
    pdfUrl: (id: string) => `api/letters/${id}/pdf`,
  };
  const page = renderPage<LetterDetailComponent, State>(LetterDetailComponent, {
    inputs: { id: 'l1', letter: LETTER(opts.letter), signing: SIGNING, signingConfig: CONFIG },
    providers: [
      {
        provide: LettersService,
        useValue: new Proxy(letters, {
          get: (t, k: string) => (k in t ? t[k as keyof typeof t] : () => ''),
        }),
      },
      {
        provide: FileDownloadService,
        useValue: { download: vi.fn(async () => undefined), busy: () => false },
      },
      { provide: SignaturesService, useValue: new Proxy({}, { get: () => () => '' }) },
    ],
    confirm: opts.confirm,
  });
  return { ...page, letters };
}

describe('LetterDetailComponent — вихідний лист', () => {
  it('реквізити, адресат, оновлення сторінки', async () => {
    const { s, letters, toast, navigate, el } = render();
    expect(el.textContent).toContain('Вигаданий Петро');
    expect(s.typeLabel()).toBeTruthy();
    expect(s.signed()).toBe(false);
    expect(s.tckOptions().length).toBeGreaterThan(0);
    s.number.set('16');
    s.date.set('2026-11-21');
    await s.saveMeta();
    expect(letters.update).toHaveBeenCalledWith('l1', { number: '16', date: '2026-11-21' });
    expect(toast.success).toHaveBeenCalledWith('Реквізити збережено');
    await s.changeTck('t2');
    expect(letters.update).toHaveBeenCalledWith('l1', { tckId: 't2' });
    s.refreshPage();
    expect(navigate).toHaveBeenCalled();
    letters.update.mockRejectedValueOnce(new Error('x'));
    await s.saveMeta();
    expect(toast.error).toHaveBeenCalled();
  });

  it('позначити переданим і видалити чернетку — з підтвердженням', async () => {
    const { s, letters, toast, navigate } = render();
    await s.markSent();
    expect(letters.markSent).toHaveBeenCalledWith('l1');
    await s.remove();
    expect(letters.remove).toHaveBeenCalledWith('l1');
    expect(toast.success).toHaveBeenCalledWith('Чернетку видалено');
    expect(navigate).toHaveBeenCalledWith(['/letters']);
    letters.remove.mockRejectedValueOnce(new Error('x'));
    await s.remove();
    expect(toast.error).toHaveBeenCalled();
  });

  it('«Залишити» — нічого не змінює; переданий лист показано', async () => {
    const { s, letters } = render({
      confirm: false,
      letter: { status: 'SENT', sentAt: '2026-11-21T10:00:00Z', external: true },
    });
    await s.markSent();
    await s.remove();
    expect(letters.markSent).not.toHaveBeenCalled();
    expect(letters.remove).not.toHaveBeenCalled();
  });
});
