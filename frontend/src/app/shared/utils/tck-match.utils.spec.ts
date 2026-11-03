import { matchTck, parseTckName } from './tck-match.utils';

const TCKS = [
  'Львівський ОТЦК та СП (м. Львів)',
  'Личаківсько-Залізничний ОРТЦК та СП (м. Львів)',
  'Сихівський РТЦК та СП (м. Львів)',
  'Шевченківський РТЦК та СП (м. Львів)',
  'Шевченківський РТЦК та СП (м. Київ)',
  'Шевченківський РТЦК та СП (м. Харків)',
  'Золочівський РТЦК та СП (м. Золочів)',
  'І відділ Золочівського РТЦК та СП (м. Броди)',
  'Амур-Нижньодніпровський РТЦК та СП (м. Дніпро)',
].map((name, i) => ({ id: `t${i}`, name }));

const nameOf = (text: string) => TCKS.find((t) => t.id === matchTck(text, TCKS))?.name ?? null;

describe('matchTck', () => {
  it('розпізнає ту саму назву, написану по-різному', () => {
    expect(nameOf('Личаківсько-Залізничний ОР у місті Львові ТЦК та СП')).toBe(TCKS[1].name);
    expect(nameOf('Сихівський районний у місті Львові ТЦК та СП')).toBe(TCKS[2].name);
    expect(nameOf('Шевченківський районний у місті Києві ТЦК та СП')).toBe(TCKS[4].name);
    expect(nameOf('Шевченківський РТЦК та СП м. Харкова')).toBe(TCKS[5].name);
    expect(nameOf('Львівський обласний ТЦК та СП')).toBe(TCKS[0].name);
    expect(nameOf('Амур-Нижньодніпровський районний ТЦК')).toBe(TCKS[8].name);
  });

  it('відрізняє відділ від самого ТЦК', () => {
    expect(nameOf('І відділ Золочівського РТЦК та СП')).toBe(TCKS[7].name);
    expect(nameOf('Золочівський РТЦК та СП')).toBe(TCKS[6].name);
  });

  it('неоднозначне або невідоме — null, поле лишається порожнім', () => {
    expect(nameOf('Шевченківський РТЦК та СП')).toBeNull();
    expect(nameOf('Невідомський РВК')).toBeNull();
    expect(matchTck('', TCKS)).toBeNull();
    expect(matchTck(null, TCKS)).toBeNull();
  });

  it('розбирає назву на прикметник, рівень, відділ і місто', () => {
    expect(parseTckName('ІІ відділ Стрийського РТЦК та СП (м. Миколаїв)')).toEqual({
      adj: 'стрийськ',
      level: 'R',
      dept: 2,
      city: 'мико',
    });
  });
});
