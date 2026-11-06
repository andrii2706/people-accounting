import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeLabels } from '../builders.js';
import { DEFAULT_LABEL_SETTINGS, ENVELOPE_PLACEMENTS } from '../label-settings.constants.js';
import type { EnvelopeLabel } from '../../shared/interfaces/document.interface.js';
import type { LabelSettings } from '../../shared/interfaces/label-settings.interface.js';
import {
  labelSettingsProblems,
  labelsPerPage,
  rowsPerPage,
  stripPostalCode,
  twips,
  withLabelDefaults,
} from './label-settings.utils.js';
import { senderParty } from './label-party.utils.js';
import type { Organization } from '../../organization/organization.entity.js';

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

  it('зіпсований порядок рядків чи блоків — стандартний', () => {
    expect(withLabelDefaults({ lineOrder: ['name', 'name', 'phone', 'address'] }).lineOrder).toEqual([
      'name',
      'address',
      'phone',
      'postalCode',
    ]);
    expect(withLabelDefaults({ partyOrder: ['recipient', 'sender'] }).partyOrder).toEqual(['recipient', 'sender']);
  });

  it('індекс лише один раз: прибирається з адреси', () => {
    expect(stripPostalCode('79000, м. Львів, вул. Зразкова, 1', '79000')).toBe('м. Львів, вул. Зразкова, 1');
    expect(stripPostalCode('вул. Умовна, 2, м. Київ, 02093', '02093')).toBe('вул. Умовна, 2, м. Київ');
    expect(stripPostalCode('вул. Умовна, 2, 79007, м. Львів', '79007')).toBe('вул. Умовна, 2, м. Львів');
    expect(stripPostalCode('вул. Умовна, 2 79007 м. Львів', '79007')).toBe('вул. Умовна, 2 м. Львів');
    // інший п’ятизначний номер не чіпаємо
    expect(stripPostalCode('вул. Умовна, 12345, м. Львів', '79007')).toBe('вул. Умовна, 12345, м. Львів');
    expect(stripPostalCode('вул. Умовна, 2', '')).toBe('вул. Умовна, 2');
  });

  it('відправник: індекс з адреси, сама адреса — без нього', () => {
    const org = {
      shortName: 'ТОВ «Приклад»',
      fullName: '',
      address: '79000, м. Львів, вул. Тестова, 1',
      postalCode: '',
      phone: '',
    };
    expect(senderParty(org as unknown as Organization)).toMatchObject({
      address: 'м. Львів, вул. Тестова, 1',
      postalCode: '79000',
    });
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
          settings: settings({
            font: 'Arial',
            showTitles: false,
            showPhone: false,
            postalPrefix: false,
            postalStyle: 'TEXT',
          }),
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
    expect(xml.match(/Від кого:/g)).toHaveLength(9);
    expect(xml.match(/Кому:/g)).toHaveLength(9);
    // наклейка точної висоти: 55 мм
    expect(xml).toContain(`w:val="${twips(55)}" w:hRule="exact"`);
  });

  it('шаблон Укрпошти: індекс у п’яти клітинках, по цифрі; без індексу — порожні клітинки', async () => {
    const xml = await documentXml(
      await buildEnvelopeLabels([{ legalEntityId: 'le1', settings: settings(), labels: [LABEL] }]),
    );
    // 79000 — цифри окремими клітинками
    for (const d of ['7', '9', '0']) expect(xml).toContain(`<w:t xml:space="preserve">${d}</w:t>`);
    expect(xml).not.toContain('Індекс:');
    // клітинки є і в отримувача (індекс невідомий)
    expect(xml.match(/<w:tblW w:type="dxa" w:w="2030"\/>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('порядок: отримувач ліворуч, індекс перед назвою', async () => {
    const xml = await documentXml(
      await buildEnvelopeLabels([
        {
          legalEntityId: 'le1',
          settings: settings({
            partyOrder: ['recipient', 'sender'],
            lineOrder: ['postalCode', 'name', 'address', 'phone'],
            postalStyle: 'TEXT',
            titleStyle: 'CLASSIC',
          }),
          labels: [LABEL],
        },
      ]),
    );
    expect(xml.indexOf('Отримувач:')).toBeLessThan(xml.indexOf('Відправник:'));
    expect(xml.indexOf('Індекс: 79000')).toBeLessThan(xml.indexOf('ТОВ «Приклад»'));
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
