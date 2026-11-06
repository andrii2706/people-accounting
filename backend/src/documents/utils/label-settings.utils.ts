import type { FieldError } from '../../shared/interfaces/common.interface.js';
import type { LabelSettings } from '../../shared/interfaces/label-settings.interface.js';
import {
  A4_MM,
  DEFAULT_LABEL_SETTINGS,
  ENVELOPE_SIZES,
  LABEL_SETTING_FIELDS,
  PAGE_TAIL_MM,
  PRINT_EDGE_MM,
} from '../label-settings.constants.js';

/** Saved settings with the defaults for keys added later (or none saved — the defaults). */
export function withLabelDefaults(saved: Partial<LabelSettings> | null | undefined): LabelSettings {
  const out = { ...DEFAULT_LABEL_SETTINGS };
  for (const key of LABEL_SETTING_FIELDS) {
    const value = saved?.[key];
    if (value !== undefined && value !== null) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Millimetres → twips of Word (1/1440 inch). */
export const twips = (mm: number) => Math.round((mm * 1440) / 25.4);

/** Width of a row of labels on A4, mm. */
export const sheetRowWidth = (s: LabelSettings) => s.columns * s.labelWidthMm + (s.columns - 1) * s.gapMm;

/** Rows of labels that fit on one A4 page. */
export function rowsPerPage(s: LabelSettings): number {
  const usable = A4_MM.heightMm - s.marginTopMm - PRINT_EDGE_MM - PAGE_TAIL_MM;
  return Math.max(1, Math.floor((usable + s.gapMm) / (s.labelHeightMm + s.gapMm)));
}

export const labelsPerPage = (s: LabelSettings) => (s.mode === 'ENVELOPE' ? 1 : s.columns * rowsPerPage(s));

/**
 * What does not fit on the paper: the labels of a row wider than A4, the blocks beyond the envelope,
 * the recipient above or to the left of the sender. Only the fields of the chosen mode are checked.
 */
export function labelSettingsProblems(s: LabelSettings): FieldError[] {
  const out: FieldError[] = [];
  if (s.mode === 'SHEET') {
    const room = A4_MM.widthMm - PRINT_EDGE_MM;
    if (s.marginLeftMm + sheetRowWidth(s) > room) {
      out.push({
        field: 'labelWidthMm',
        message: `Ряд наклейок не вміщується по ширині A4: відступ + наклейки = ${s.marginLeftMm + sheetRowWidth(s)} мм, доступно ${room} мм`,
      });
    }
    const height = A4_MM.heightMm - PRINT_EDGE_MM - PAGE_TAIL_MM;
    if (s.marginTopMm + s.labelHeightMm > height) {
      out.push({
        field: 'labelHeightMm',
        message: `Наклейка не вміщується по висоті A4: відступ + висота = ${s.marginTopMm + s.labelHeightMm} мм, доступно ${height} мм`,
      });
    }
    if (2 * s.paddingMm >= s.labelHeightMm) {
      out.push({ field: 'paddingMm', message: 'Поле всередині більше за саму наклейку' });
    }
    return out;
  }

  const env = ENVELOPE_SIZES[s.envelope];
  const right = env.widthMm - 3;
  if (s.senderXMm + s.senderWidthMm > right) {
    out.push({
      field: 'senderWidthMm',
      message: `Відправник виходить за правий край конверта (${s.senderXMm + s.senderWidthMm} з ${right} мм)`,
    });
  }
  if (s.recipientXMm + s.recipientWidthMm > right) {
    out.push({
      field: 'recipientWidthMm',
      message: `Отримувач виходить за правий край конверта (${s.recipientXMm + s.recipientWidthMm} з ${right} мм)`,
    });
  }
  if (s.recipientXMm < s.senderXMm) {
    out.push({ field: 'recipientXMm', message: 'Отримувач має бути не лівіше за відправника' });
  }
  if (s.recipientYMm < s.senderYMm + 15) {
    out.push({ field: 'recipientYMm', message: 'Отримувач має бути щонайменше на 15 мм нижче за відправника' });
  }
  if (s.recipientYMm > env.heightMm - 25) {
    out.push({
      field: 'recipientYMm',
      message: `Під отримувачем замало місця: конверт ${env.heightMm} мм заввишки, потрібно хоча б 25 мм`,
    });
  }
  return out;
}
