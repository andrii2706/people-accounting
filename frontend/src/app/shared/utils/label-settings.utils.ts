import {
  A4_MM,
  ENVELOPE_PLACEMENTS,
  ENVELOPE_SIZES,
  PAGE_TAIL_MM,
  PRINT_EDGE_MM,
} from '../constants/label-settings.constants';
import type {
  EnvelopeFormat,
  EnvelopeSize,
  LabelFieldProblem,
  LabelPage,
  LabelPrintGroup,
  LabelSettings,
} from '../interfaces/label-settings.interface';

/** The same rules as on the server (documents/utils/label-settings.utils.ts) — the form shows them at once. */

export const sheetRowWidth = (s: LabelSettings) =>
  s.columns * s.labelWidthMm + (s.columns - 1) * s.gapMm;

export function rowsPerPage(s: LabelSettings): number {
  const usable = A4_MM.heightMm - s.marginTopMm - PRINT_EDGE_MM - PAGE_TAIL_MM;
  return Math.max(1, Math.floor((usable + s.gapMm) / (s.labelHeightMm + s.gapMm)));
}

export const labelsPerPage = (s: LabelSettings) =>
  s.mode === 'ENVELOPE' ? 1 : s.columns * rowsPerPage(s);

/** Size of a printed page: A4 or the envelope. */
export const pageSize = (s: LabelSettings): EnvelopeSize =>
  s.mode === 'ENVELOPE' ? ENVELOPE_SIZES[s.envelope] : A4_MM;

/** Another envelope format: the places of the sender and the recipient that suit it. */
export const withEnvelope = (s: LabelSettings, envelope: EnvelopeFormat): LabelSettings => ({
  ...s,
  envelope,
  ...ENVELOPE_PLACEMENTS[envelope],
});

export function labelSettingsProblems(s: LabelSettings): LabelFieldProblem[] {
  const out: LabelFieldProblem[] = [];
  if (s.mode === 'SHEET') {
    const room = A4_MM.widthMm - PRINT_EDGE_MM;
    const used = s.marginLeftMm + sheetRowWidth(s);
    if (used > room) {
      out.push({
        field: 'labelWidthMm',
        message: `Ряд наклейок не вміщується по ширині A4: відступ + наклейки = ${used} мм, доступно ${room} мм`,
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
    out.push({
      field: 'recipientYMm',
      message: 'Отримувач має бути щонайменше на 15 мм нижче за відправника',
    });
  }
  if (s.recipientYMm > env.heightMm - 25) {
    out.push({
      field: 'recipientYMm',
      message: `Під отримувачем замало місця: конверт ${env.heightMm} мм заввишки, потрібно хоча б 25 мм`,
    });
  }
  return out;
}

/** The printed pages of all groups, in order. */
export function labelPages(groups: LabelPrintGroup[]): LabelPage[] {
  return groups.flatMap((g, group) => {
    const per = labelsPerPage(g.settings);
    return Array.from({ length: Math.ceil(g.labels.length / per) }, (_, i) => ({
      group,
      settings: g.settings,
      labels: g.labels.slice(i * per, (i + 1) * per),
    }));
  });
}

/** @page rules: every group prints on its own paper (A4 or the envelope), without margins of the browser. */
export function pageRules(groups: LabelPrintGroup[]): string {
  return [
    '@page { margin: 0; }',
    ...groups.map((g, i) => {
      const size = pageSize(g.settings);
      return `@page labels-${i} { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }`;
    }),
  ].join('\n');
}

/** «Індекс: 79000» or just «79000»; a blank to write by hand when the code is unknown. */
export const postalLine = (code: string, prefix: boolean) => {
  const value = code || '________';
  return prefix ? `Індекс: ${value}` : value;
};

/** The item moved from one place to another; the others keep their order. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}
