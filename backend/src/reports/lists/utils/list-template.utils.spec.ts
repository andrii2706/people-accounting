import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { buildListTemplateExample } from '../../../documents/builders.js';
import type { ListTemplateData } from '../../../shared/interfaces/list-settings.interface.js';
import { LIST_COLUMN_KEYS } from '../lists.constants.js';
import { inspectListTemplate, ListTemplateError, renderListTemplate } from './list-template.utils.js';

const documentXml = (buffer: Buffer) => new PizZip(buffer).file('word/document.xml')!.asText();

/** A minimal .docx with the given paragraph text. */
function docx(text: string): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

const data: ListTemplateData = {
  title: 'Список',
  subtitle: 'офіцерського складу',
  whom: 'Керівнику ТЦК',
  date: '01.11.2026',
  outNumber: '12',
  outDate: '01.11.2026',
  extract: false,
  org: {
    fullName: 'ТОВ «Приклад»',
    shortName: 'Приклад',
    edrpou: '11111111',
    address: 'м. Київ',
    headPosition: 'Директор',
    headName: 'Іван ПРИКЛАДНИЙ',
  },
  count: 1,
  rows: [{ n: '1', number: '1', fullName: 'Вигаданий Петро Іванович', rank: 'лейтенант' }],
  groups: [],
  signers: [{ position: 'Директор', name: 'Іван ПРИКЛАДНИЙ' }],
};

describe('list templates', () => {
  it('the example template passes the check and renders the rows', async () => {
    const example = await buildListTemplateExample('OFFICERS', [...LIST_COLUMN_KEYS]);
    const tags = inspectListTemplate(example);
    expect(tags).toContain('rows');
    const out = renderListTemplate(example, data);
    const xml = documentXml(out);
    expect(xml).toContain('Вигаданий Петро Іванович');
    expect(xml).toContain('Іван ПРИКЛАДНИЙ');
    expect(xml).not.toContain('{fullName}');
  });

  it('rejects unknown tags', () => {
    expect(() => inspectListTemplate(docx('{salary}'))).toThrow(ListTemplateError);
  });

  it('rejects a template without tags and a file that is not Word', () => {
    expect(() => inspectListTemplate(docx('Просто текст'))).toThrow(ListTemplateError);
    expect(() => inspectListTemplate(Buffer.from('not a zip'))).toThrow(ListTemplateError);
  });

  it('explains an unclosed loop', () => {
    expect(() => inspectListTemplate(docx('{#rows}{fullName}'))).toThrow(/не закрито/);
  });
});
