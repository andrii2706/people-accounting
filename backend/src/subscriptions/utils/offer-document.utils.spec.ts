import { describe, expect, it } from 'vitest';
import { buildOfferDocument } from './offer-document.utils.js';

describe('buildOfferDocument', () => {
  const input = {
    id: '00000000-0000-4000-8000-000000000002',
    createdAt: new Date('2026-11-12T10:00:00Z'),
    terms: {
      version: '2026-11-12',
      title: 'Договір публічної оферти',
      intro: 'Вступ.',
      sections: [{ title: '1. Терміни', paragraphs: ['Перший.', 'Другий.'] }],
    },
    entity: {
      fullName: 'ТОВ «Приклад»',
      edrpou: '12345678',
      address: '',
      headPosition: 'Директор',
      headName: 'Іван ПРИКЛАДНИЙ',
    },
  };

  it('містить текст оферти, редакцію і реквізити замовника', () => {
    const text = buildOfferDocument(input);
    expect(text).toContain('Договір публічної оферти\nРедакція від 2026-11-12');
    expect(text).toContain('1. Терміни\nПерший.\nДругий.');
    expect(text).toContain('Замовник: ТОВ «Приклад»');
    expect(text).toContain('Код за ЄДРПОУ: 12345678');
    expect(text).toContain('В особі керівника: Директор Іван ПРИКЛАДНИЙ');
    expect(text).toContain('Номер заяви: 00000000-0000-4000-8000-000000000002');
  });

  it('без адреси — без порожнього рядка «Місцезнаходження» і подвійних порожніх рядків', () => {
    const text = buildOfferDocument(input);
    expect(text).not.toContain('Місцезнаходження');
    expect(text).not.toMatch(/\n\n\n/);
  });
});
