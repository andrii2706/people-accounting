import Docxtemplater from 'docxtemplater';
import { createRequire } from 'node:module';
import PizZip from 'pizzip';
import type { ListTemplateData, TemplateInspector } from '../../../shared/interfaces/list-settings.interface.js';
import { KNOWN_TEMPLATE_TAGS, MAX_TEMPLATE_BYTES, MAX_TEMPLATE_UNZIPPED } from '../lists.constants.js';

// the inspect module is CommonJS exporting a factory — loaded the CommonJS way
const createInspector = createRequire(import.meta.url)('docxtemplater/js/inspect-module.js') as () => TemplateInspector;

/** A problem of an uploaded template that the user can fix in Word. */
export class ListTemplateError extends Error {}

interface ZipEntry {
  _data?: { uncompressedSize?: number };
}

interface DocxtemplaterErrorDetail {
  properties?: { explanation?: string; id?: string; xtag?: string };
  message?: string;
}

/** Open a .docx: a zip with word/document.xml, not too big when unpacked. */
function openDocx(buffer: Buffer): PizZip {
  if (buffer.length > MAX_TEMPLATE_BYTES) throw new ListTemplateError('Файл завеликий — не більше 2 МБ');
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch {
    throw new ListTemplateError('Це не файл Word (.docx). Збережіть шаблон у Word як «Документ Word (.docx)»');
  }
  if (!zip.file('word/document.xml')) throw new ListTemplateError('У файлі немає документа Word — потрібен .docx');
  const unzipped = Object.values(zip.files).reduce(
    (sum, f) => sum + ((f as unknown as ZipEntry)._data?.uncompressedSize ?? 0),
    0,
  );
  if (unzipped > MAX_TEMPLATE_UNZIPPED) throw new ListTemplateError('Шаблон завеликий після розпакування');
  return zip;
}

function compile(zip: PizZip, modules: TemplateInspector[] = []): Docxtemplater {
  try {
    // no expressions parser: tags are plain names — nothing in a template can run code
    return new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: modules as never[],
      nullGetter: () => '',
    });
  } catch (err) {
    throw new ListTemplateError(templateErrorText(err));
  }
}

/** docxtemplater's error → «Мітку {#rows} не закрито …» in plain words. */
function templateErrorText(err: unknown): string {
  const details = ((err as { properties?: { errors?: DocxtemplaterErrorDetail[] } }).properties?.errors ?? [
    err as DocxtemplaterErrorDetail,
  ]) as DocxtemplaterErrorDetail[];
  const texts = details.slice(0, 5).map((d) => {
    const tag = d.properties?.xtag ? `{${d.properties.xtag}}` : '';
    switch (d.properties?.id) {
      case 'unclosed_loop':
        return `Цикл ${tag} не закрито — додайте {/${d.properties.xtag ?? ''}}`;
      case 'unopened_loop':
        return `Закриття ${tag} без відкриття`;
      case 'unclosed_tag':
        return `Мітку ${tag} не закрито фігурною дужкою`;
      case 'unopened_tag':
        return `Зайва закривна дужка біля ${tag}`;
      case 'closing_tag_does_not_match_opening_tag':
        return `Закриття циклу не відповідає відкриттю ${tag}`;
      default:
        return d.properties?.explanation ?? d.message ?? 'Помилка в мітках шаблону';
    }
  });
  return `Шаблон містить помилки: ${texts.join('; ')}`;
}

/** Names of all tags in a template, loops included («rows», «fullName» inside it …). */
function tagNames(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    const nested = value && typeof value === 'object' ? tagNames(value as Record<string, unknown>) : [];
    return [key.includes('.') ? key : name.split('.').pop()!, key, ...nested];
  });
}

/** Check an uploaded template: a .docx, the tags well-formed and known. Returns the tags it uses. */
export function inspectListTemplate(buffer: Buffer): string[] {
  const inspect = createInspector();
  compile(openDocx(buffer), [inspect]);
  const tags = [...new Set(tagNames(inspect.getAllTags()))];
  const unknown = tags.filter((t) => !KNOWN_TEMPLATE_TAGS.has(t));
  if (unknown.length) {
    throw new ListTemplateError(
      `Невідомі мітки: ${unknown
        .slice(0, 8)
        .map((t) => `{${t}}`)
        .join(', ')}. Перевірте написання (латиницею) за довідкою`,
    );
  }
  if (!tags.length) throw new ListTemplateError('У шаблоні немає жодної мітки — додайте хоча б {#rows}…{/rows}');
  return tags;
}

/** Fill a template with a list. */
export function renderListTemplate(buffer: Buffer, data: ListTemplateData): Buffer {
  const doc = compile(openDocx(buffer));
  try {
    doc.render(data);
  } catch (err) {
    throw new ListTemplateError(templateErrorText(err));
  }
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
