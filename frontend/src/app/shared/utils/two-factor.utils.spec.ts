import { isCodeLike, normalizeCode, qrPath, recoveryCodesText } from './two-factor.utils';

describe('two-factor utils', () => {
  it('draws the dark cells only, shifted by the quiet zone', () => {
    expect(qrPath({ size: 2, cells: '1001' }, 4)).toBe('M4 4h1v1h-1zM5 5h1v1h-1z');
    expect(qrPath({ size: 1, cells: '0' })).toBe('');
  });

  it('normalizes what people type', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456');
    expect(normalizeCode('k7qm9xda')).toBe('K7QM-9XDA');
    expect(normalizeCode('k7qm-9xda')).toBe('K7QM-9XDA');
    expect(isCodeLike('123 456')).toBe(true);
    expect(isCodeLike('k7qm 9xda')).toBe(true);
    expect(isCodeLike('12345')).toBe(false);
    expect(isCodeLike('K7QM-9XD0')).toBe(false);
  });

  it('a text file with numbered codes', () => {
    const text = recoveryCodesText(['AAAA-BBBB', 'CCCC-DDDD'], 'hr@example.com');
    expect(text).toContain('hr@example.com');
    expect(text).toContain(' 1. AAAA-BBBB');
    expect(text).toContain(' 2. CCCC-DDDD');
  });
});
