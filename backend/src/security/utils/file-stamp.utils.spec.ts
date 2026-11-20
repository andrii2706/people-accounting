import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { dispositionFileName, isZip, STAMP_PROPERTY, stampOfficeFile, stampText } from './file-stamp.utils.js';

async function office(withCustom = false) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="word/document.xml"/></Relationships>',
  );
  zip.file('word/document.xml', '<w:document/>');
  if (withCustom) {
    zip.file(
      'docProps/custom.xml',
      '<?xml version="1.0"?><Properties xmlns="x" xmlns:vt="y"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Інше"><vt:lpwstr>а</vt:lpwstr></property></Properties>',
    );
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('stampOfficeFile', () => {
  it('adds the property, its type and relation', async () => {
    const out = await stampOfficeFile(await office(), 'Іваненко <a&b>');
    expect(out).not.toBeNull();
    const zip = await JSZip.loadAsync(out!);
    const custom = await zip.file('docProps/custom.xml')!.async('string');
    expect(custom).toContain(`name="${STAMP_PROPERTY}"`);
    expect(custom).toContain('Іваненко &lt;a&amp;b&gt;');
    expect(await zip.file('[Content_Types].xml')!.async('string')).toContain('/docProps/custom.xml');
    const rels = await zip.file('_rels/.rels')!.async('string');
    expect(rels).toContain('custom-properties');
    expect(rels).toContain('rId1');
    expect(await zip.file('word/document.xml')!.async('string')).toBe('<w:document/>');
  });

  it('keeps existing custom properties', async () => {
    const zip = await JSZip.loadAsync((await stampOfficeFile(await office(true), 'x'))!);
    const custom = await zip.file('docProps/custom.xml')!.async('string');
    expect(custom).toContain('name="Інше"');
    expect(custom).toContain('pid="3"');
  });

  it('fills the empty properties the docx library writes', async () => {
    const zip = await JSZip.loadAsync(await office());
    zip.file('docProps/custom.xml', '<?xml version="1.0"?><Properties xmlns="x" xmlns:vt="y"/>');
    const out = await JSZip.loadAsync((await stampOfficeFile(await zip.generateAsync({ type: 'nodebuffer' }), 'x'))!);
    const custom = await out.file('docProps/custom.xml')!.async('string');
    expect(custom).toMatch(
      /<Properties xmlns="x" xmlns:vt="y"><property [^>]*pid="2"[^>]*><vt:lpwstr>x<\/vt:lpwstr><\/property><\/Properties>/,
    );
  });

  it('leaves other files alone', async () => {
    expect(await stampOfficeFile(Buffer.from('%PDF-1.7'), 'x')).toBeNull();
    const plain = new JSZip();
    plain.file('a.txt', 'a');
    expect(await stampOfficeFile(await plain.generateAsync({ type: 'nodebuffer' }), 'x')).toBeNull();
    expect(isZip(Buffer.from('PK\x03\x04rest'))).toBe(true);
  });
});

describe('stampText / dispositionFileName', () => {
  it('who and when', () => {
    expect(stampText('ab12', 'Олена', new Date('2026-11-20T12:05:00Z'))).toMatch(/^№ ab12 · Олена · 20\.11\.(20)?26/);
  });

  it('reads the Unicode name', () => {
    expect(
      dispositionFileName(`attachment; filename="file"; filename*=UTF-8''${encodeURIComponent('Лист № 5.docx')}`),
    ).toBe('Лист № 5.docx');
    expect(dispositionFileName('attachment; filename="a.docx"')).toBe('a.docx');
    expect(dispositionFileName(undefined)).toBe('');
  });
});
