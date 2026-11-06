import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeLabels } from '../builders.js';
import { DEFAULT_LABEL_SETTINGS, ENVELOPE_PLACEMENTS } from '../label-settings.constants.js';
import type { EnvelopeLabel } from '../../shared/interfaces/document.interface.js';
import type { LabelSettings } from '../../shared/interfaces/label-settings.interface.js';
import { labelSettingsProblems, labelsPerPage, rowsPerPage, twips, withLabelDefaults } from './label-settings.utils.js';

const settings = (over: Partial<LabelSettings> = {}): LabelSettings => ({ ...DEFAULT_LABEL_SETTINGS, ...over });

/** Fictional parties. */
const LABEL: EnvelopeLabel = {
  sender: { name: 'ТОВ «Приклад»', address: 'вул. Тестова, 1, м. Львів', postalCode: '79000', phone: '+380320000000' },
  recipient: { name: 'Тестовий РТЦК та СП', address: 'вул. Умовна, 2, м. Львів', postalCode: '', phone: '' },
};

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml')!.async('string');
}

describe('налаштування наклейок', () => {
  it('без збережених — як було раніше; нові ключі добираються зі стандартних', () => {
    expect(withLabelDefaults(null)).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(withLabelDefaults({ font: 'Arial' })).toMatchObject({ font: 'Arial', nameSize: 13, mode: 'SHEET' });
  });

  it('мм → twips', () => {
    expect(twips(25.4)).toBe(1440);
    expect(twips(10)).toBe(567);
  });

  it('скільки наклейок на аркуші A4', () => {
    // 297 − 20 − 5 − 2 = 270 мм; (270 + 4) / (55 + 4) = 4,6 → 4 ряди
    expect(rowsPerPage(settings())).toBe(4);
    expect(labelsPerPage(settings({ columns: 2, labelWidthMm: 80 }))).toBe(8);
    expect(labelsPerPage(settings({ mode: 'ENVELOPE' }))).toBe(1);
  });

  it('стандартні налаштування й місця на кожному форматі конверта вміщуються', () => {
    expect(labelSettingsProblems(settings())).toEqual([]);
    for (const placement of Object.values(ENVELOPE_PLACEMENTS)) {
      const envelope = (Object.keys(ENVELOPE_PLACEMENTS) as LabelSettings['envelope'][]).find(
        (k) => ENVELOPE_PLACEMENTS[k] === placement,
      )!;
      expect(labelSettingsProblems(settings({ mode: 'ENVELOPE', envelope, ...placement }))).toEqual([]);
    }
  });

  it('ряд, ширший за A4, — помилка біля ширини', () => {
    const problems = labelSettingsProblems(settings({ columns: 2, labelWidthMm: 100 }));
    expect(problems.map((p) => p.field)).toEqual(['labelWidthMm']);
  });

  it('конверт: отримувач за краєм, вище за відправника', () => {
    const fields = labelSettingsProblems(
      settings({ mode: 'ENVELOPE', envelope: 'DL', recipientXMm: 150, recipientWidthMm: 100, recipientYMm: 15 }),
    ).map((p) => p.field);
    expect(fields).toEqual(['recipientWidthMm', 'recipientYMm']);
  });

  it('A4-поля не перевіряються в режимі конверта, і навпаки', () => {
    expect(labelSettingsProblems(settings({ mode: 'ENVELOPE', columns: 3, labelWidthMm: 200 }))).toEqual([]);
    expect(labelSettingsProblems(settings({ recipientXMm: 300 }))).toEqual([]);
  });
});

describe('наклейки .docx за налаштуваннями', () => {
  it('шрифт, рядки й «Індекс:» — з налаштувань', async () => {
    const xml = await documentXml(
      await buildEnvelopeLabels([
        {
          legalEntityId: 'le1',
          settings: settings({ font: 'Arial', showTitles: false, showPhone: false, postalPrefix: false }),
          labels: [LABEL],
        },
      ]),
    );
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).not.toContain('Відправник:');
    expect(xml).not.toContain('тел.');
    expect(xml).not.toContain('Індекс:');
    expect(xml).toContain('79000');
  });

  it('аркуш: 9 наклейок по 4 на сторінці — 3 сторінки, 2 розриви', async () => {
    const xml = await documentXml(
      await buildEnvelopeLabels([{ legalEntityId: 'le1', settings: settings(), labels: Array(9).fill(LABEL) }]),
    );
    expect(xml.match(/w:type="page"/g)).toHaveLength(2);
    expect(xml.match(/Відправник:/g)).toHaveLength(9);
    // наклейка точної висоти: 55 мм
    expect(xml).toContain(`w:val="${twips(55)}" w:hRule="exact"`);
  });

  it('конверт DL: сторінка 220×110 мм, відступи — місце відправника', async () => {
    const s = settings({ mode: 'ENVELOPE', envelope: 'DL', ...ENVELOPE_PLACEMENTS.DL });
    const xml = await documentXml(await buildEnvelopeLabels([{ legalEntityId: 'le1', settings: s, labels: [LABEL] }]));
    expect(xml).toMatch(new RegExp(`<w:pgSz w:w="${twips(220)}" w:h="${twips(110)}" w:orient="landscape"`));
    expect(xml).toContain(`w:top="${twips(10)}"`);
    expect(xml).toContain(`w:left="${twips(10)}"`);
  });

  it('кожна юрособа — своєю секцією зі своїми налаштуваннями', async () => {
    const xml = await documentXml(
      await buildEnvelopeLabels([
        { legalEntityId: 'a', settings: settings(), labels: [LABEL] },
        { legalEntityId: 'b', settings: settings({ mode: 'ENVELOPE', ...ENVELOPE_PLACEMENTS.DL }), labels: [LABEL] },
      ]),
    );
    expect(xml.match(/<w:sectPr/g)).toHaveLength(2);
  });
});
