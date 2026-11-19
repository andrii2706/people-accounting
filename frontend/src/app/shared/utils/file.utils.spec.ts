import { describe, expect, it } from 'vitest';
import { fileNameFromDisposition } from './file.utils';

describe('fileNameFromDisposition', () => {
  it('takes the Unicode name first, the plain one otherwise', () => {
    expect(
      fileNameFromDisposition(
        `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent('Опис вкладення ф107 4.docx')}`,
      ),
    ).toBe('Опис вкладення ф107 4.docx');
    expect(fileNameFromDisposition('attachment; filename="report.docx"')).toBe('report.docx');
    expect(fileNameFromDisposition(null)).toBeNull();
  });
});
