import { securityDetails } from './security.utils';

describe('securityDetails', () => {
  it('names the details and the reasons in words', () => {
    expect(securityDetails({ details: { failures: 24, accounts: 4 } })).toBe(
      'спроб: 24 · облікових записів: 4',
    );
    expect(securityDetails({ details: { file: 'a.docx', reason: 'MACRO' } })).toBe(
      'файл: a.docx · причина: макроси',
    );
    expect(securityDetails({ details: {} })).toBe('');
  });
});
