import ExcelJS from 'exceljs';
import { formatUa } from '../../common/utils/dates.utils.js';
import type { DismissalNoticeView } from '../../shared/interfaces/employee.interface.js';

/** One row of the export of the dismissed. */
export interface DismissedRow {
  fullName: string;
  personnelNumber: string;
  position: string;
  dismissalDate: string | null;
  order: string;
  notice: DismissalNoticeView | null;
  legalEntityName: string;
}

const NOTICE_TEXT: Record<DismissalNoticeView['status'], string> = {
  SENT: 'надіслано',
  IN_LETTER: 'у листі, не надіслано',
  PENDING: 'очікує',
  NONE: 'не потрібне',
};

/** The notice column: «надіслано № 15/118» / «очікує · до 26.11.2026». */
export function noticeText(n: DismissalNoticeView | null): string {
  if (!n) return '';
  const number = n.letterNumber ? ` № ${n.letterNumber}` : '';
  const until = n.deadline ? ` · до ${formatUa(n.deadline)}` : '';
  return `${NOTICE_TEXT[n.status]}${number}${until}`;
}

/** «Звільнені»: an .xlsx with the dismissal, the order and the notice to the TCK. */
export async function dismissedXlsx(rows: DismissedRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Звільнені');
  sheet.columns = [
    { header: 'Працівник', key: 'fullName', width: 34 },
    { header: 'Таб. №', key: 'personnelNumber', width: 10 },
    { header: 'Остання посада', key: 'position', width: 28 },
    { header: 'Звільнений', key: 'dismissalDate', width: 13 },
    { header: 'Наказ', key: 'order', width: 30 },
    { header: 'Повідомлення ТЦК', key: 'notice', width: 30 },
    { header: 'Юрособа', key: 'legalEntityName', width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('personnelNumber').numFmt = '@';
  for (const r of rows) {
    sheet.addRow({
      ...r,
      dismissalDate: r.dismissalDate ? formatUa(r.dismissalDate) : '',
      notice: noticeText(r.notice),
    });
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
