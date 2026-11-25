import { DEFAULT_LABEL_SETTINGS } from '../../../shared/constants/label-settings.constants';
import type {
  LabelSettings,
  LabelSettingsPageData,
} from '../../../shared/interfaces/label-settings.interface';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { LabelPrintComponent } from '../../print/label-print/label-print.component';
import { LabelSettingsComponent } from './label-settings.component';

/** A label of a fictional company. */
const LABEL = { name: 'Вигадана компанія', lines: ['м. Тестове'], postalCode: '01001' };
const DATA: LabelSettingsPageData = {
  entityId: 'le1',
  entityName: 'Вигадана компанія',
  settings: DEFAULT_LABEL_SETTINGS,
  sample: { sender: LABEL, recipient: LABEL },
} as unknown as LabelSettingsPageData;

type State = {
  model: { (): LabelSettings; update: (fn: (m: LabelSettings) => LabelSettings) => void };
  set: (k: keyof LabelSettings, v: unknown) => void;
  lineItems: () => { value: string }[];
  partyItems: () => { value: string }[];
  setLineOrder: (o: string[]) => void;
  setPartyOrder: (o: string[]) => void;
  setEnvelope: (v: string) => void;
  resetDefaults: () => void;
  save: (e: Event) => Promise<void>;
  testPrint: () => void;
  perPage: () => number;
  rows: () => number;
  previewWidth: () => number;
  previewHeight: () => number;
  envelopeSize: () => unknown;
  previewPages: () => unknown[];
};

function render() {
  const service = { saveLabelSettings: vi.fn(async () => DEFAULT_LABEL_SETTINGS) };
  const page = renderPage<LabelSettingsComponent, State>(LabelSettingsComponent, {
    inputs: { data: DATA },
    providers: [{ provide: LegalEntitiesService, useValue: service }],
  });
  return { ...page, service };
}

describe('LabelSettingsComponent — наклейки на конверти', () => {
  it('порядок рядків і сторін, конверт, стандартні налаштування, збереження', async () => {
    const { s, service, toast, update } = render();
    expect(s.perPage()).toBeGreaterThan(0);
    expect(s.rows()).toBeGreaterThan(0);
    expect(s.previewWidth()).toBeGreaterThan(0);
    expect(s.previewHeight()).toBeGreaterThan(0);
    expect(s.previewPages()).toHaveLength(1);
    s.setLineOrder([...s.lineItems().map((i) => i.value)].reverse());
    s.setPartyOrder([...s.partyItems().map((i) => i.value)].reverse());
    s.setEnvelope('');
    s.setEnvelope('C5');
    expect(s.model().envelope).toBe('C5');
    expect(s.envelopeSize()).toBeTruthy();
    s.set('mode', 'ENVELOPE');
    update();
    s.resetDefaults();
    expect(toast.info).toHaveBeenCalled();
    await s.save(submitEvent());
    expect(service.saveLabelSettings).toHaveBeenCalledWith('le1', expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith('Налаштування наклейок збережено');
    service.saveLabelSettings.mockRejectedValueOnce(new Error('x'));
    await s.save(submitEvent());
    expect(toast.error).toHaveBeenCalled();
  });

  it('пробний друк: з помилками — ні; інакше — на сторінку друку з налаштуваннями', () => {
    const { s, navigate, toast, update } = render();
    s.testPrint();
    expect(navigate).toHaveBeenCalledWith(
      ['/print/labels'],
      expect.objectContaining({
        state: expect.objectContaining({
          labelTestPrint: expect.objectContaining({ legalEntityId: 'le1' }),
        }),
      }),
    );
    s.model.update((m) => ({ ...m, titleSize: 999 }) as LabelSettings);
    update();
    s.testPrint();
    expect(toast.error).toHaveBeenCalledWith('Спершу виправте позначені поля');
  });
});

describe('LabelPrintComponent — друк наклейок', () => {
  const groups = [
    {
      legalEntityId: 'le1',
      settings: DEFAULT_LABEL_SETTINGS,
      labels: [{ sender: LABEL, recipient: LABEL }],
    },
    {
      legalEntityId: 'le1',
      settings: { ...DEFAULT_LABEL_SETTINGS, mode: 'ENVELOPE', envelope: 'DL' },
      labels: [{ sender: LABEL, recipient: LABEL }],
    },
  ];
  type Print = {
    count: () => number;
    envelopes: () => string[];
    hasSheets: () => boolean;
    print: () => void;
    close: () => void;
  };

  it('кількість, конверти, друк; «Назад» — до налаштувань або до листів', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
    const page = renderPage<LabelPrintComponent, Print>(LabelPrintComponent, {
      inputs: { data: { groups }, back: '/settings/le1/labels' },
    });
    await new Promise((r) => setTimeout(r));
    expect(page.s.count()).toBe(2);
    expect(page.s.envelopes()[0]).toContain('DL');
    expect(page.s.hasSheets()).toBe(true);
    expect(print).toHaveBeenCalled();
    page.s.close();
    expect(page.navigateByUrl).toHaveBeenCalledWith('/settings/le1/labels');
    vi.useFakeTimers();
    page.fixture.componentRef.setInput('back', '');
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    page.s.close();
    vi.advanceTimersByTime(100);
    expect(page.navigateByUrl).toHaveBeenCalledWith('/letters');
    vi.useRealTimers();
    close.mockRestore();
    print.mockRestore();
    page.fixture.destroy();
  });
});
