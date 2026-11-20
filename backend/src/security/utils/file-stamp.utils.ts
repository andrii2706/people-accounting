import JSZip from 'jszip';

/** Custom properties of Office files (Word → Файл → Відомості → Властивості → Додаткові). */
const CUSTOM_PART = 'docProps/custom.xml';
const CUSTOM_TYPE = 'application/vnd.openxmlformats-officedocument.custom-properties+xml';
const CUSTOM_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';
const FMTID = '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}';
export const STAMP_PROPERTY = 'Вивантаження';

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** «№ 3f2a… · Іваненко Олена · 20.11.2026, 14:05» — who downloaded the file and when. */
export function stampText(exportId: string, userName: string, at: Date) {
  const when = at.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' });
  return `№ ${exportId} · ${userName} · ${when}`;
}

export const isZip = (buffer: Buffer) => buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;

/**
 * Writes «who and when» into the properties of a Word / Excel file (not into the text — the letter to the TCK
 * looks the same). null — not an Office file, it is left as is.
 */
export async function stampOfficeFile(buffer: Buffer, text: string): Promise<Buffer | null> {
  if (!isZip(buffer)) return null;
  const zip = await JSZip.loadAsync(buffer);
  const types = zip.file('[Content_Types].xml');
  const rels = zip.file('_rels/.rels');
  if (!types || !rels) return null;
  const value = `<vt:lpwstr>${xmlEscape(text)}</vt:lpwstr>`;
  const existing = zip.file(CUSTOM_PART);
  if (existing) {
    let xml = await existing.async('string');
    const pids = [...xml.matchAll(/pid="(\d+)"/g)].map((m) => Number(m[1]));
    const pid = Math.max(1, ...pids) + 1;
    const property = `<property fmtid="${FMTID}" pid="${pid}" name="${STAMP_PROPERTY}">${value}</property>`;
    // the docx library writes an empty «<Properties … />»
    xml = xml.includes('</Properties>')
      ? xml.replace('</Properties>', `${property}</Properties>`)
      : xml.replace(/<Properties\b([^>]*?)\s*\/>/, `<Properties$1>${property}</Properties>`);
    zip.file(CUSTOM_PART, xml);
  } else {
    zip.file(
      CUSTOM_PART,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        `<property fmtid="${FMTID}" pid="2" name="${STAMP_PROPERTY}">${value}</property></Properties>`,
    );
    let typesXml = await types.async('string');
    if (!typesXml.includes('/docProps/custom.xml')) {
      typesXml = typesXml.replace(
        '</Types>',
        `<Override PartName="/${CUSTOM_PART}" ContentType="${CUSTOM_TYPE}"/></Types>`,
      );
      zip.file('[Content_Types].xml', typesXml);
    }
    let relsXml = await rels.async('string');
    if (!relsXml.includes(CUSTOM_REL)) {
      let n = 1;
      while (relsXml.includes(`Id="rIdMr${n}"`)) n++;
      relsXml = relsXml.replace(
        '</Relationships>',
        `<Relationship Id="rIdMr${n}" Type="${CUSTOM_REL}" Target="${CUSTOM_PART}"/></Relationships>`,
      );
      zip.file('_rels/.rels', relsXml);
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** The file name from Content-Disposition (filename*=UTF-8''… first). */
export function dispositionFileName(disposition: string | string[] | undefined): string {
  const header = Array.isArray(disposition) ? disposition.join('; ') : (disposition ?? '');
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]).slice(0, 200);
    } catch {
      /* falls back to the plain name */
    }
  }
  return (/filename="([^"]*)"/i.exec(header)?.[1] ?? '').slice(0, 200);
}
