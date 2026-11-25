import { describe, expect, it, vi } from 'vitest';
import { fileNameFromDisposition, fromBase64, saveBlob, saveBytes, toBase64 } from './file.utils';

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

describe('base64 і збереження файлів', () => {
  it('toBase64 ↔ fromBase64 — без втрат', () => {
    const bytes = new TextEncoder().encode('Тестовий документ');
    const b64 = toBase64(bytes.buffer as ArrayBuffer);
    expect(Array.from(fromBase64(b64))).toEqual(Array.from(bytes));
  });

  it('зламане кодування імені — береться просте ім’я', () => {
    expect(
      fileNameFromDisposition(`attachment; filename*=UTF-8''%E0%A4%A; filename="plain.docx"`),
    ).toBe('plain.docx');
    expect(fileNameFromDisposition('inline')).toBeNull();
  });

  it('saveBytes і saveBlob — посилання з ім’ям, URL звільняється', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    saveBytes(new Uint8Array([1, 2]), 'a.txt', 'text/plain');
    saveBlob(new Blob(['x']), 'b.docx');
    expect(click).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledTimes(2);
    click.mockRestore();
    vi.useRealTimers();
  });
});
