import { formatPhone, joinPhone, splitPhone } from './phone.utils';

describe('телефон: код країни окремо, далі лише цифри', () => {
  it('розбирає збережене значення', () => {
    expect(splitPhone('+380670000000')).toEqual({ code: '380', national: '670000000' });
    expect(splitPhone('+48600000000')).toEqual({ code: '48', national: '600000000' });
    expect(splitPhone('067 000 00 00')).toEqual({ code: '380', national: '670000000' });
    expect(splitPhone('')).toEqual({ code: '380', national: '' });
  });

  it('збирає значення з набраних цифр', () => {
    expect(joinPhone('380', '067 000-00-00')).toBe('+380670000000');
    expect(joinPhone('380', '670000000')).toBe('+380670000000');
    expect(joinPhone('48', '600 000 000')).toBe('+48600000000');
    expect(joinPhone('380', '')).toBe('');
  });

  it('показує номер групами', () => {
    expect(formatPhone('+380670000000')).toBe('+380 67 000 00 00');
    expect(formatPhone('+48600000000')).toBe('+48 600 000 000');
    expect(formatPhone('')).toBe('');
  });
});
