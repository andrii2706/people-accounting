import { MESSAGE, normalizeVos, PATTERN, rnokppMismatch } from './employee-rules';

describe('employee rules', () => {
  describe('ВОС', () => {
    it('офіцери: 6 цифр, можна з літерою або через дефіс', () => {
      for (const vos of ['021101', '021101А', '021-101', '021101 а']) {
        expect(PATTERN.vosOfficer.test(vos)).toBe(true);
      }
      for (const vos of ['21101', '0211', 'ABCDEF', '100']) {
        expect(PATTERN.vosOfficer.test(vos)).toBe(false);
      }
    });

    it('рядові та сержанти: 3 або 6 цифр, можна з літерою', () => {
      for (const vos of ['100', '837А', '100915', '100-915', '100915А']) {
        expect(PATTERN.vosOther.test(vos)).toBe(true);
      }
      for (const vos of ['10', '1000', 'ABC', '10A']) {
        expect(PATTERN.vosOther.test(vos)).toBe(false);
      }
    });

    it('зберігається без пробілів і дефісів, літера велика', () => {
      expect(normalizeVos('021-101 а')).toBe('021101А');
      expect(normalizeVos(' 100 915 ')).toBe('100915');
    });

    it('підказки пояснюють формат прикладами', () => {
      expect(MESSAGE.vosOfficer).toContain('021101');
      expect(MESSAGE.vosOther).toContain('100915');
    });
  });

  describe('РНОКПП', () => {
    // 01.01.1990 = 32873 days since 31.12.1899; the 9th digit is odd for men, even for women
    const male = '3287300019';
    const female = '3287300028';

    it('збігається з датою народження і статтю', () => {
      expect(rnokppMismatch(male, '1990-01-01', 'M')).toBeNull();
      expect(rnokppMismatch(female, '1990-01-01', 'F')).toBeNull();
    });

    it('пояснює розбіжність', () => {
      expect(rnokppMismatch(male, '1991-01-01', 'M')).toContain('01.01.1990');
      expect(rnokppMismatch(male, '1990-01-01', 'F')).toContain('чоловіча');
    });

    it('не перевіряє неповні дані', () => {
      expect(rnokppMismatch('', '1990-01-01', 'M')).toBeNull();
      expect(rnokppMismatch(male, '', 'M')).toBeNull();
    });
  });

  it('ЄДРПОУ — рівно 8 цифр', () => {
    expect(PATTERN.edrpou.test('12345678')).toBe(true);
    expect(PATTERN.edrpou.test('1234567')).toBe(false);
    expect(PATTERN.edrpou.test('1234567A')).toBe(false);
  });

  it('час формування е-документа — 24-годинний ГГ:ХХ', () => {
    expect(PATTERN.docGeneratedTime.test('09:05')).toBe(true);
    expect(PATTERN.docGeneratedTime.test('23:59')).toBe(true);
    expect(PATTERN.docGeneratedTime.test('24:00')).toBe(false);
    expect(PATTERN.docGeneratedTime.test('9:05')).toBe(false);
  });
});
