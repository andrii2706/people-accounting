import { StreamableFile } from '@nestjs/common';
import { DOCX_MIME } from '../constants/mime.constants.js';

/** A .docx download. */
export function docxFile(buffer: Buffer, filename: string) {
  return new StreamableFile(buffer, {
    type: DOCX_MIME,
    disposition: `attachment; filename="document.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

/** A file download with a Unicode file name. */
export function attachmentFile(buffer: Buffer, filename: string, type: string) {
  return new StreamableFile(buffer, {
    type,
    disposition: `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}
