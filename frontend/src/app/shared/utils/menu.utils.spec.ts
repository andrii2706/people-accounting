import { menuPosition, orderedActions } from './menu.utils';

describe('меню дій рядка', () => {
  const viewport = { width: 1280, height: 800 };

  it('відкривається вниз під кнопкою, праворуч по її краю', () => {
    expect(menuPosition({ top: 100, bottom: 132, right: 1200 }, viewport)).toEqual({
      right: 80,
      top: 136,
      bottom: null,
    });
  });

  it('рядок унизу сторінки — меню відкривається вгору', () => {
    expect(menuPosition({ top: 700, bottom: 732, right: 1200 }, viewport)).toEqual({
      right: 80,
      top: null,
      bottom: 104,
    });
  });

  it('небезпечні дії — в кінці', () => {
    const order = orderedActions([
      { label: 'Заблокувати', danger: true },
      { label: 'Редагувати' },
      { label: 'Скинути пароль' },
    ]).map((a) => a.label);
    expect(order).toEqual(['Редагувати', 'Скинути пароль', 'Заблокувати']);
  });
});
