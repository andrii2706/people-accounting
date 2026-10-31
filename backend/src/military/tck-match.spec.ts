import { describe, expect, it } from 'vitest';
import { ALL_TCK } from '../database/tck-directory.js';
import { matchTck } from './tck-match.js';

const tcks = ALL_TCK.map((t, i) => ({ id: String(i), name: t.name }));
const nameOf = (text: string) => {
  const id = matchTck(text, tcks);
  return id === null ? null : tcks[Number(id)].name;
};

describe('matchTck — назва ТЦК з документа → довідник', () => {
  it('різні написання того самого ТЦК', () => {
    expect(nameOf('Личаківсько-Залізничний ОР у місті Львові ТЦК та СП')).toBe('Личаківсько-Залізничний ОРТЦК та СП (м. Львів)');
    expect(nameOf('Личаківсько-Залізничний ОРТЦК та СП (м. Львів)')).toBe('Личаківсько-Залізничний ОРТЦК та СП (м. Львів)');
    expect(nameOf('Сихівський районний у місті Львові ТЦК та СП')).toBe('Сихівський РТЦК та СП (м. Львів)');
    expect(nameOf('Шевченківський районний у місті Києві ТЦК та СП')).toBe('Шевченківський РТЦК та СП (м. Київ)');
    expect(nameOf('Шевченківський РТЦК та СП м. Львова')).toBe('Шевченківський РТЦК та СП (м. Львів)');
    expect(nameOf('Дарницький РТЦК та СП м. Києва')).toBe('Дарницький РТЦК та СП (м. Київ)');
    expect(nameOf('Львівський обласний ТЦК та СП')).toBe('Львівський ОТЦК та СП (м. Львів)');
    expect(nameOf('Стрийський районний ТЦК та СП')).toBe('Стрийський РТЦК та СП (м. Стрий)');
    expect(nameOf('І відділ Золочівського РТЦК та СП')).toBe('І відділ Золочівського РТЦК та СП (м. Броди)');
    expect(nameOf('Золочівський РТЦК та СП')).toBe('Золочівський РТЦК та СП (м. Золочів)');
  });

  it('неоднозначне або невідоме — порожньо', () => {
    expect(nameOf('Шевченківський РТЦК та СП')).toBeNull(); // є у Львові, Києві, Харкові…
    expect(nameOf('Невідомський РВК')).toBeNull();
    expect(nameOf('')).toBeNull();
    expect(nameOf('паспортний стіл')).toBeNull();
  });
});
