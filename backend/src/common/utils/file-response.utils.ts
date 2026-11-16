import { StreamableFile } from '@nestjs/common';
import { DOCX_MIME, documentMime, ZIP_MIME } from '../constants/mime.constants.js';
import type { RenderedListDocument } from '../../shared/interfaces/list-settings.interface.js';

/** A .docx download. */
export function docxFile(buffer: Buffer, filename: string) {
  return new StreamableFile(buffer, {
    type: DOCX_MIME,
    disposition: `attachment; filename="document.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

/** A generated document (.docx or .zip) by its file name. */
export function documentFile(buffer: Buffer, filename: string) {
  return attachmentFile(buffer, filename, documentMime(filename));
}

/** A file download with a Unicode file name. */
export function attachmentFile(buffer: Buffer, filename: string, type: string) {
  return new StreamableFile(buffer, {
    type,
    disposition: `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

/** A lists document: one Word file or a .zip with a file per list. */
export function listsFile(doc: RenderedListDocument, baseName: string) {
  return doc.kind === 'zip'
    ? attachmentFile(doc.buffer, `${baseName}.zip`, ZIP_MIME)
    : docxFile(doc.buffer, `${baseName}.docx`);
}
