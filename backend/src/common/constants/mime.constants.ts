/** MIME types of the generated documents. */

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const P7S_MIME = 'application/pkcs7-signature';

export const TEXT_MIME = 'text/plain; charset=utf-8';

export const ZIP_MIME = 'application/zip';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A generated document is a .docx, or a .zip with a file per list (own Word templates). */
export function documentMime(filename: string) {
  return /\.zip$/i.test(filename) ? ZIP_MIME : DOCX_MIME;
}
