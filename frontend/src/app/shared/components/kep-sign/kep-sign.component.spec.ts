import { IitSignWidgetService } from '../../services/iit-sign-widget.service';
import { renderPage } from '../../../testing/page.testing';
import { KepSignComponent } from './kep-sign.component';

/** A document of a test (not a real offer): «тест» in base64. */
const DOC = { fileName: 'заява.txt', content: btoa('test') };

type State = {
  mode: () => string;
  stage: () => string;
  setMode: (m: 'widget' | 'upload') => void;
  download: () => void;
  readKey: () => Promise<void>;
  signHere: () => Promise<void>;
  upload: (e: Event) => Promise<void>;
};

function render(enabled = true) {
  const widget = {
    close: vi.fn(),
    readKey: vi.fn(async () => undefined),
    signDetached: vi.fn(async () => 'MIIB'),
  };
  const page = renderPage<KepSignComponent, State>(KepSignComponent, {
    inputs: {
      document: DOC,
      widgetConfig: {
        enabled,
        scriptUrl: 'https://widget.example.com/eusign.js',
        frameUrl: 'https://widget.example.com/',
      },
    },
    providers: [{ provide: IitSignWidgetService, useValue: widget }],
  });
  const signed = vi.fn();
  page.fixture.componentInstance.signed.subscribe(signed);
  return { ...page, widget, signed };
}

describe('KepSignComponent — підпис КЕП', () => {
  it('віджет: ключ → підпис; помилки — повідомлення', async () => {
    const { s, widget, signed, toast, update } = render();
    expect(s.mode()).toBe('widget');
    await s.readKey();
    expect(s.stage()).toBe('ready');
    update();
    await s.signHere();
    expect(widget.signDetached).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(signed).toHaveBeenCalledWith('MIIB');
    widget.signDetached.mockRejectedValueOnce(new Error('Ключ не придатний'));
    await s.signHere();
    widget.signDetached.mockRejectedValueOnce('?');
    await s.signHere();
    expect(toast.error).toHaveBeenCalledWith('Не вдалося підписати');
    widget.readKey.mockRejectedValueOnce(new Error('Невірний пароль ключа'));
    await s.readKey();
    widget.readKey.mockRejectedValueOnce('?');
    await s.readKey();
    expect(toast.error).toHaveBeenCalledWith('Не вдалося зчитати ключ');
    expect(s.stage()).toBe('idle');
  });

  it('інша програма: завантажити документ і додати .p7s', async () => {
    const { s, signed, toast, widget, update, fixture } = render(false);
    expect(s.mode()).toBe('upload');
    s.setMode('widget');
    s.setMode('upload');
    expect(widget.close).toHaveBeenCalled();
    update();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    s.download();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    await s.upload({ target: { files: [], value: '' } } as unknown as Event);
    await s.upload({
      target: { files: [new File(['x'.repeat(800 * 1024)], 'a.p7s')], value: '' },
    } as unknown as Event);
    expect(toast.error).toHaveBeenCalledTimes(1);
    await s.upload({
      target: { files: [new File(['sig'], 'a.p7s')], value: '' },
    } as unknown as Event);
    expect(signed).toHaveBeenCalledWith(btoa('sig'));
    fixture.destroy();
  });
});
