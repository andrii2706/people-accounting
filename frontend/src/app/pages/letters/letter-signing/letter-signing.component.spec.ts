import type { SigningConfig, SigningState } from '../../../shared/interfaces/signature.interface';
import { IitSignWidgetService } from '../../../shared/services/iit-sign-widget.service';
import { SignaturesService } from '../../../shared/services/signatures.service';
import { renderPage } from '../../../testing/page.testing';
import { LetterSigningComponent } from './letter-signing.component';

const STATE: SigningState = {
  frozen: true,
  documentSha256: 'a'.repeat(64),
  documentFilename: 'лист.docx',
  documentFrozenAt: '2026-11-20T10:00:00Z',
  signatures: [],
};
const CONFIG = (enabled = true): SigningConfig => ({
  widget: {
    enabled,
    scriptUrl: 'https://widget.example.com/eusign.js',
    frameUrl: 'https://widget.example.com/',
  },
  verifyUrl: 'https://czo.gov.ua/verify',
});

type State = {
  mode: () => string;
  setMode: (m: 'widget' | 'upload') => void;
  shortHash: () => string;
  hasSignatures: () => boolean;
  widgetStage: () => string;
  freeze: () => Promise<void>;
  unfreeze: () => Promise<void>;
  readKey: () => Promise<void>;
  signWithWidget: () => Promise<void>;
  upload: (e: Event) => Promise<void>;
};

function render(
  opts: { enabled?: boolean; confirm?: boolean; state?: Partial<SigningState> } = {},
) {
  const signatures = {
    freeze: vi.fn(async () => undefined),
    unfreeze: vi.fn(async () => undefined),
    signingFile: vi.fn(async () => new ArrayBuffer(4)),
    add: vi.fn(async () => undefined),
    downloadUrl: () => '',
    packageUrl: () => '',
    signingFileUrl: () => '',
    signatureFileUrl: () => '',
  };
  const widget = {
    close: vi.fn(),
    readKey: vi.fn(async () => undefined),
    signDetached: vi.fn(async () => 'MIIB'),
  };
  const page = renderPage<LetterSigningComponent, State>(LetterSigningComponent, {
    inputs: {
      letterId: 'l1',
      letterStatus: 'DRAFT',
      state: { ...STATE, ...opts.state },
      config: CONFIG(opts.enabled ?? true),
    },
    providers: [
      { provide: SignaturesService, useValue: signatures },
      { provide: IitSignWidgetService, useValue: widget },
    ],
    confirm: opts.confirm,
  });
  const changed = vi.fn();
  page.fixture.componentInstance.changed.subscribe(changed);
  return { ...page, signatures, widget, changed };
}

const p7s = (size = 10) =>
  ({
    target: { files: [new File(['x'.repeat(size)], 'підпис.p7s')], value: 'x' },
  }) as unknown as Event;

describe('LetterSigningComponent — КЕП-підпис листа', () => {
  it('віджет за замовчуванням; коротка хеш-сума; зміна способу закриває віджет', () => {
    const { s, widget } = render();
    expect(s.mode()).toBe('widget');
    expect(s.shortHash()).toBe('aaaaaaaa…aaaaaaaa');
    expect(s.hasSignatures()).toBe(false);
    s.setMode('upload');
    expect(s.mode()).toBe('upload');
    expect(widget.close).toHaveBeenCalled();
  });

  it('без віджета — завантаження .p7s; не зафіксовано — без хеша', () => {
    const { s } = render({ enabled: false, state: { frozen: false, documentSha256: null } });
    expect(s.mode()).toBe('upload');
    expect(s.shortHash()).toBe('');
  });

  it('зафіксувати / скасувати фіксацію з підтвердженням', async () => {
    const { s, signatures, toast, changed } = render();
    await s.freeze();
    expect(signatures.freeze).toHaveBeenCalledWith('l1');
    expect(toast.success).toHaveBeenCalledWith('Документ зафіксовано для підпису');
    await s.unfreeze();
    expect(signatures.unfreeze).toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(2);
    signatures.freeze.mockRejectedValueOnce(new Error('x'));
    await s.freeze();
    expect(toast.error).toHaveBeenCalled();
  });

  it('скасувати фіксацію — «Залишити»', async () => {
    const { s, signatures } = render({ confirm: false });
    await s.unfreeze();
    expect(signatures.unfreeze).not.toHaveBeenCalled();
  });

  it('віджет: зчитати ключ і підписати; помилки — повідомлення', async () => {
    const { s, widget, signatures, toast, changed } = render();
    await s.readKey();
    expect(s.widgetStage()).toBe('ready');
    await s.signWithWidget();
    expect(widget.signDetached).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(signatures.add).toHaveBeenCalledWith('l1', 'MIIB', 'WIDGET');
    expect(toast.success).toHaveBeenCalledWith('Документ підписано');
    expect(changed).toHaveBeenCalled();
    expect(s.widgetStage()).toBe('idle');
    widget.readKey.mockRejectedValueOnce(new Error('Невірний пароль ключа'));
    await s.readKey();
    expect(toast.error).toHaveBeenCalledWith('Невірний пароль ключа');
    widget.readKey.mockRejectedValueOnce('?');
    await s.readKey();
    expect(toast.error).toHaveBeenCalledWith('Не вдалося зчитати ключ');
    widget.signDetached.mockRejectedValueOnce(new Error('Ключ не придатний для підпису'));
    await s.signWithWidget();
    expect(toast.error).toHaveBeenCalledWith('Ключ не придатний для підпису');
    expect(s.widgetStage()).toBe('ready');
  });

  it('завантажити .p7s: завеликий — відмова; інакше — додано', async () => {
    const { s, signatures, toast } = render({ enabled: false });
    await s.upload({ target: { files: [], value: '' } } as unknown as Event);
    await s.upload(p7s(2 * 1024 * 1024));
    expect(toast.error).toHaveBeenCalledTimes(1);
    await s.upload(p7s());
    expect(signatures.add).toHaveBeenCalledWith('l1', expect.any(String), 'UPLOAD');
    expect(toast.success).toHaveBeenCalledWith('Підпис додано');
  });

  it('закриття панелі — закриває віджет', () => {
    const { fixture, widget } = render();
    fixture.destroy();
    expect(widget.close).toHaveBeenCalled();
  });
});
