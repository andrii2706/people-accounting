/** What an uploaded file may not be or carry (see utils/file-safety.utils). */

/** Names that are programs or scripts whatever is inside. */
export const EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'dll',
  'com',
  'scr',
  'pif',
  'msi',
  'msp',
  'bat',
  'cmd',
  'ps1',
  'psm1',
  'vbs',
  'vbe',
  'js',
  'jse',
  'wsf',
  'wsh',
  'hta',
  'lnk',
  'jar',
  'sh',
  'apk',
  'app',
  'dmg',
  'iso',
  'img',
  'reg',
  'cpl',
  'msc',
  'scf',
  'url',
  'inf',
  'html',
  'htm',
  'xhtml',
  'svg',
  'xml',
  'php',
  'asp',
  'aspx',
  'jsp',
  'py',
  'pl',
  'rb',
  'docm',
  'dotm',
  'xlsm',
  'xltm',
  'xlam',
  'pptm',
  'potm',
  'ppam',
  'xla',
  'xll',
]);

/** Text that is a page or a script. */
export const SCRIPT_MARKERS: [string, RegExp][] = [
  ['скрипт (<script>)', /<script[\s>/]/i],
  ['вебсторінку', /<!doctype\s+html|<html[\s>]|<hta:application/i],
  ['вбудовану сторінку', /<(iframe|object|embed|applet)[\s>/]/i],
  ['обробник подій у розмітці', /<[a-z][^>]*\son[a-z]+\s*=/i],
  ['посилання javascript:', /(?:java|vb)script\s*:/i],
  ['код PHP', /<\?php/i],
  ['команди PowerShell', /\bpowershell(\.exe)?\s+-|\bInvoke-Expression\b|\bIEX\s*\(|\bFromBase64String\b/i],
  ['команди Windows Script Host', /\bWScript\.Shell\b|\bCreateObject\s*\(\s*["']WScript|\bActiveXObject\b/i],
];

/** A CSV cell that is a command or reaches out when Excel opens the file. */
export const CSV_FORMULA_DANGER =
  /(\|.*!|\b(cmd|dde|msexcel|powershell|mshta|rundll32)\b|\b(HYPERLINK|WEBSERVICE|IMPORTXML|IMPORTDATA|IMPORTHTML|IMAGE|FILTERXML|CALL|REGISTER|EXEC)\s*\()/i;

/** Content types of Office files with macros or ActiveX. */
export const OFFICE_MACRO_TYPES = /macroEnabled|vbaProject|ms-office\.activeX|ms-excel\.intl?macrosheet|vbaData/i;

/** Parts of an Office file that carry code or foreign objects. */
export const OFFICE_FORBIDDEN_PARTS: [string, RegExp][] = [
  ['макроси', /vbaproject\.bin$|vbadata\.xml$|(^|\/)macrosheets\/|(^|\/)vba\//],
  ['елементи ActiveX', /(^|\/)activex\//],
  ['посилання на інші книги', /^xl\/externallinks\//],
  ['вбудовані об’єкти OLE', /oleobject\d*\.bin$|\.(exe|dll|bat|cmd|ps1|vbs|js|hta|scr|lnk|jar|msi)$/],
];

/** PDF actions that run code or open something. */
export const UPLOAD_PDF_DANGER: [string, RegExp][] = [
  ['JavaScript', /\/(JavaScript|JS)\b/],
  ['запуск програм', /\/Launch\b/],
  ['вкладені файли', /\/EmbeddedFiles?\b/],
  ['вбудовані медіа', /\/RichMedia\b/],
  ['надсилання форм', /\/SubmitForm\b/],
  ['імпорт даних', /\/ImportData\b/],
];

/** A «zip bomb»: an Office file is a zip — a small one may unpack into gigabytes. */
export const UPLOAD_MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
export const UPLOAD_MAX_ENTRIES = 3000;
export const UPLOAD_MAX_RATIO = 200;
/** An Excel table embedded in a Word file (a chart) is checked as well — but not deeper. */
export const UPLOAD_MAX_NESTING = 1;
