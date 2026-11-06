import { describe, expect, it } from 'vitest';
import { DEFAULT_LABEL_SETTINGS, ENVELOPE_PLACEMENTS } from '../constants/label-settings.constants';
import type { EnvelopeLabel, LabelSettings } from '../interfaces/label-settings.interface';
import {
  labelPages,
  labelSettingsProblems,
  labelsPerPage,
  moveItem,
  pageRules,
  withEnvelope,
} from './label-settings.utils';

const s = (over: Partial<LabelSettings> = {}): LabelSettings => ({
  ...DEFAULT_LABEL_SETTINGS,
  ...over,
});
const LABEL: EnvelopeLabel = {
  sender: { name: 'ТОВ «Приклад»', address: 'вул. Тестова, 1', postalCode: '79000', phone: '' },
  recipient: { name: 'Тестовий ТЦК', address: 'вул. Умовна, 2', postalCode: '79008', phone: '' },
};

describe('наклейки: розрахунки', () => {
  it('як на сервері: 4 на аркуші за замовчуванням, конверт — по одному', () => {
    expect(labelsPerPage(s())).toBe(4);
    expect(labelsPerPage(s({ columns: 2, labelWidthMm: 80 }))).toBe(8);
    expect(labelsPerPage(s({ mode: 'ENVELOPE' }))).toBe(1);
  });

  it('перетягування: елемент переходить на нове місце, інші — по порядку', () => {
    const lines = ['name', 'address', 'phone', 'postalCode'];
    expect(moveItem(lines, 3, 0)).toEqual(['postalCode', 'name', 'address', 'phone']);
    expect(moveItem(lines, 0, 2)).toEqual(['address', 'phone', 'name', 'postalCode']);
    expect(lines).toEqual(['name', 'address', 'phone', 'postalCode']);
  });

  it('новий формат конверта переносить і місця блоків', () => {
    expect(withEnvelope(s(), 'C5')).toMatchObject({ envelope: 'C5', ...ENVELOPE_PLACEMENTS.C5 });
  });

  it('помилки — біля тих полів, що їх спричинили', () => {
    expect(labelSettingsProblems(s())).toEqual([]);
    expect(labelSettingsProblems(s({ columns: 2, labelWidthMm: 100 })).map((p) => p.field)).toEqual(
      ['labelWidthMm'],
    );
    expect(
      labelSettingsProblems(s({ mode: 'ENVELOPE', recipientXMm: 5, recipientYMm: 12 })).map(
        (p) => p.field,
      ),
    ).toEqual(['recipientXMm', 'recipientYMm']);
  });

  it('сторінки: 9 наклейок A4 → 3 сторінки; конверти — по одному; @page для кожної групи', () => {
    const groups = [
      { legalEntityId: 'a', settings: s(), labels: Array<EnvelopeLabel>(9).fill(LABEL) },
      { legalEntityId: 'b', settings: s({ mode: 'ENVELOPE' }), labels: [LABEL, LABEL] },
    ];
    const pages = labelPages(groups);
    expect(pages.map((p) => [p.group, p.labels.length])).toEqual([
      [0, 4],
      [0, 4],
      [0, 1],
      [1, 1],
      [1, 1],
    ]);
    expect(pageRules(groups)).toContain('@page labels-1 { size: 220mm 110mm; margin: 0; }');
  });
});
