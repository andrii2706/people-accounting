/**
 * Checks an uploaded file before anything reads it: it must really be what its name says, and it must not carry
 * anything that runs — a program, a macro, a script, an embedded object, a link that pulls content from
 * outside (a remote template, DDE). Such a file is refused whole: nothing of it is read or stored.
 */
import { inflateSync } from 'node:zlib';
import JSZip from 'jszip';
import type { UnsafeFileVerdict, UploadKind } from '../../shared/interfaces/security.interface.js';
import {
  CSV_FORMULA_DANGER,
  EXECUTABLE_EXTENSIONS,
  OFFICE_FORBIDDEN_PARTS,
  OFFICE_MACRO_TYPES,
  SCRIPT_MARKERS,
  UPLOAD_MAX_ENTRIES,
  UPLOAD_MAX_NESTING,
  UPLOAD_MAX_RATIO,
  UPLOAD_MAX_UNPACKED_BYTES,
  UPLOAD_PDF_DANGER,
} from '../upload-safety.constants.js';

export interface FileVerdict extends UnsafeFileVerdict {
  /** A real threat (reported to the administrators), not just a wrong kind of file. */
  dangerous: boolean;
}

const verdict = (reason: string, message: string, dangerous = true): FileVerdict => ({ reason, message, dangerous });

/** What the first bytes say the file is. */
export function sniff(buffer: Buffer): string {
  const b = buffer;
  const hex = b.subarray(0, 8).toString('hex');
  if (b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a) return 'exe';
  if (hex.startsWith('7f454c46')) return 'elf';
  if (/^(feedface|feedfacf|cefaedfe|cffaedfe|cafebabe)/.test(hex)) return 'macho';
  if (hex.startsWith('d0cf11e0a1b11ae1')) return 'ole';
  if (hex.startsWith('4c0000000114020000')) return 'lnk';
  if (hex.startsWith('504b0304') || hex.startsWith('504b0506')) return 'zip';
  if (hex.startsWith('25504446')) return 'pdf';
  if (hex.startsWith('526172211a07')) return 'rar';
  if (hex.startsWith('377abcaf271c')) return '7z';
  if (hex.startsWith('1f8b')) return 'gzip';
  if (b.length >= 2 && b[0] === 0x23 && b[1] === 0x21) return 'shebang';
  if (b.length && b[0] === 0x30) return 'der';
  return b.includes(0) ? 'binary' : 'text';
}

const extensionOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();

/** A script / page / program in text form (HTML, SVG with handlers, HTA, PHP, PowerShell…). */
export function scriptMarker(text: string): string | null {
  for (const [name, re] of SCRIPT_MARKERS) if (re.test(text)) return name;
  return null;
}

/** Null — the file is fine; otherwise why it is refused. */
export async function inspectUpload(buffer: Buffer, fileName: string, kind: UploadKind): Promise<FileVerdict | null> {
  if (!buffer.length) return verdict('EMPTY', 'Файл порожній', false);
  const ext = extensionOf(fileName);
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    return verdict('EXECUTABLE', `Файли .${ext} не приймаються: це програма або скрипт`);
  }
  const type = sniff(buffer);
  if (['exe', 'elf', 'macho', 'lnk', 'shebang'].includes(type)) {
    return verdict('EXECUTABLE', 'Це програма, а не документ. Файл не прийнято.');
  }
  if (type === 'pdf') {
    const danger = pdfDanger(buffer);
    if (danger) return verdict('SCRIPT', `PDF містить ${danger} — такі файли не приймаються`);
  }
  if (type === 'text' || type === 'binary') {
    const marker = scriptMarker(buffer.toString('latin1'));
    if (marker) return verdict('SCRIPT', `Файл містить ${marker}. Такі файли не приймаються.`);
  }
  switch (kind) {
    case 'table':
      if (ext === 'csv' || ext === 'txt') return type === 'text' ? csvDanger(buffer) : mismatch('таблицю .csv');
      if (ext !== 'xlsx') return mismatch('таблицю .xlsx або .csv');
      return type === 'zip' ? inspectOffice(buffer, 'xl/workbook.xml') : oleOrMismatch(type, 'таблицю .xlsx');
    case 'docx':
      if (ext !== 'docx') return mismatch('документ Word .docx');
      return type === 'zip' ? inspectOffice(buffer, 'word/document.xml') : oleOrMismatch(type, 'документ .docx');
    case 'signature':
      return type === 'der' || (type === 'text' && /^[\sA-Za-z0-9+/=_\-:]*$/.test(buffer.toString('latin1')))
        ? null
        : mismatch('файл підпису .p7s');
  }
}

const mismatch = (what: string) =>
  verdict('TYPE_MISMATCH', `Вміст файлу не відповідає його назві: очікується ${what}`, false);

/** An old .xls / .doc renamed — or a package (OLE) that may carry macros. */
function oleOrMismatch(type: string, what: string) {
  return type === 'ole'
    ? verdict('TYPE_MISMATCH', `Це файл старого формату Office. Відкрийте його й збережіть як ${what}.`, false)
    : mismatch(what);
}

/** Cells that start a command via DDE or «=HYPERLINK(…)» run when the table is opened in Excel. */
function csvDanger(buffer: Buffer): FileVerdict | null {
  const text = buffer.toString('utf8');
  for (const cell of text.split(/[\r\n,;\t]+/)) {
    const c = cell.trim().replace(/^"+/, '');
    if (/^[=+\-@]/.test(c) && CSV_FORMULA_DANGER.test(c)) {
      return verdict(
        'FORMULA',
        'У таблиці є формула, що запускає команди або звертається в інтернет. Файл не прийнято.',
      );
    }
  }
  return null;
}

/** /JavaScript, /Launch, embedded files — in the plain text of the PDF and in its packed streams. */
export function pdfDanger(buffer: Buffer): string | null {
  // «/J#61vaScript» is «/JavaScript»: names may be written with #hex escapes
  const normalize = (s: string) =>
    s.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  const raw = buffer.toString('latin1');
  const parts = [normalize(raw)];
  const streams = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  let budget = UPLOAD_MAX_UNPACKED_BYTES;
  while ((m = streams.exec(raw)) && budget > 0) {
    try {
      const out = inflateSync(Buffer.from(m[1], 'latin1'), { maxOutputLength: Math.min(budget, 8 * 1024 * 1024) });
      budget -= out.length;
      parts.push(normalize(out.toString('latin1')));
    } catch {
      /* not a packed stream (an image, a font) */
    }
  }
  for (const text of parts) {
    for (const [name, re] of UPLOAD_PDF_DANGER) if (re.test(text)) return name;
  }
  return null;
}

interface ZipEntryData {
  _data?: { uncompressedSize?: number; compressedSize?: number };
}

/**
 * Word / Excel: no macros (vbaProject), ActiveX, OLE objects, macro sheets, links to other workbooks,
 * remote templates or frames, DDE fields — and no «zip bomb» that unpacks into gigabytes.
 */
export async function inspectOffice(buffer: Buffer, mainPart: string, depth = 0): Promise<FileVerdict | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return verdict('TYPE_MISMATCH', 'Файл пошкоджений або це не документ Office', false);
  }
  const entries = Object.values(zip.files);
  if (entries.length > UPLOAD_MAX_ENTRIES) return verdict('ARCHIVE_BOMB', 'У файлі забагато частин — його не прийнято');
  let unpacked = 0;
  for (const e of entries) {
    const name = e.name.replace(/\\/g, '/');
    if (name.startsWith('/') || name.split('/').includes('..')) {
      return verdict('PATH_TRAVERSAL', 'Файл містить шляхи за межі документа — його не прийнято');
    }
    const data = (e as unknown as ZipEntryData)._data;
    const size = data?.uncompressedSize ?? 0;
    unpacked += size;
    if (data?.compressedSize && size / data.compressedSize > UPLOAD_MAX_RATIO && size > 1024 * 1024) {
      return verdict('ARCHIVE_BOMB', 'Файл розпаковується в непомірно великий обсяг — його не прийнято');
    }
  }
  if (unpacked > UPLOAD_MAX_UNPACKED_BYTES) {
    return verdict('ARCHIVE_BOMB', 'Файл розпаковується в непомірно великий обсяг — його не прийнято');
  }
  const types = await zip.file('[Content_Types].xml')?.async('string');
  if (types === undefined || !zip.file(mainPart)) {
    return depth ? null : verdict('TYPE_MISMATCH', 'Це не документ Word / Excel потрібного виду', false);
  }
  if (OFFICE_MACRO_TYPES.test(types))
    return verdict('MACRO', 'Файл містить макроси. Збережіть його як звичайний .docx / .xlsx без макросів.');

  for (const e of entries) {
    if (e.dir) continue;
    const name = e.name.toLowerCase();
    const forbidden = OFFICE_FORBIDDEN_PARTS.find(([, re]) => re.test(name));
    if (forbidden)
      return verdict(
        forbidden[0] === 'макроси' ? 'MACRO' : 'EMBEDDED_OBJECT',
        `Файл містить ${forbidden[0]} — його не прийнято`,
      );
    if (name.includes('/embeddings/')) {
      const ext = extensionOf(name);
      if (!['xlsx', 'docx'].includes(ext) || depth >= UPLOAD_MAX_NESTING) {
        return verdict('EMBEDDED_OBJECT', 'Файл містить вбудований об’єкт або програму — його не прийнято');
      }
      const nested = await inspectOffice(
        await e.async('nodebuffer'),
        ext === 'xlsx' ? 'xl/workbook.xml' : 'word/document.xml',
        depth + 1,
      );
      if (nested) return nested;
      continue;
    }
    if (name.endsWith('.rels')) {
      const problem = externalProblem(await e.async('string'));
      if (problem) return problem;
    } else if (
      /^(word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(name)
    ) {
      const xml = await e.async('string');
      // a field code may be split into many runs («DD» + «EAUTO») — they are read together
      const fields = [
        ...[...xml.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)].map((f) => f[1]),
        ...[...xml.matchAll(/w:instr="([^"]*)"/g)].map((f) => f[1]),
      ].join('');
      if (/\bDDE(AUTO)?\b/i.test(fields) || /<ddeLink\b/i.test(xml)) {
        return verdict('DDE', 'Файл містить поле DDE, що запускає команди — його не прийнято');
      }
      if (/INCLUDE(TEXT|PICTURE)\s+"?(\\\\|https?:|file:)/i.test(fields)) {
        return verdict('EXTERNAL_LINK', 'Файл підтягує вміст з інших адрес — його не прийнято');
      }
      if (/<f>[^<]*(WEBSERVICE|FILTERXML|CALL\(|REGISTER\(|EXEC\()/i.test(xml)) {
        return verdict('FORMULA', 'У таблиці є формула, що звертається в інтернет або запускає код — файл не прийнято');
      }
    }
  }
  return null;
}

/** A relationship that loads something from outside: a remote template, frame, OLE object, a UNC path. */
function externalProblem(rels: string): FileVerdict | null {
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = m[0];
    if (!/TargetMode="External"/i.test(tag)) continue;
    const type = /Type="([^"]*)"/.exec(tag)?.[1] ?? '';
    const target = (/Target="([^"]*)"/.exec(tag)?.[1] ?? '').trim();
    // Word remembers the template a document was made from: a path on the local disk is harmless
    if (/attachedTemplate$/i.test(type) && /^(file:\/\/\/)?[a-z]:[\\/]/i.test(target)) continue;
    if (/(attachedTemplate|oleObject|frame|subDocument|externalLinkPath|package|image|audio|video)$/i.test(type)) {
      return verdict('EXTERNAL_LINK', 'Файл підтягує шаблон або об’єкт з іншої адреси — його не прийнято');
    }
    if (!/^(https?:|mailto:)/i.test(target)) {
      return verdict(
        'EXTERNAL_LINK',
        'Файл містить посилання, що відкриває програму або мережеву папку — його не прийнято',
      );
    }
  }
  return null;
}
