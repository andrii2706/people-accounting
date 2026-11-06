import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LABEL_FONT_STACKS, LABEL_TITLES } from '../../constants/label-settings.constants';
import type {
  EnvelopeSize,
  LabelPage,
  LabelSettings,
} from '../../interfaces/label-settings.interface';
import { pageSize, postalLine } from '../../utils/label-settings.utils';

/**
 * Pages of envelope labels in millimetres — the same layout as the .docx: A4 with labels of exact size,
 * or an envelope with the sender and the recipient in their places. Used by the preview and the print page.
 */
@Component({
  selector: 'app-label-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './label-sheet.component.html',
  styles: `
    :host {
      display: block;
    }
    .label-page {
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
      color: #000;
      line-height: 1.15;
    }
    @media print {
      .label-page {
        break-after: page;
      }
      .label-page:last-child {
        break-after: auto;
      }
    }
  `,
})
export class LabelSheetComponent {
  readonly pages = input.required<LabelPage[]>();
  /** Gap and shadow between the pages on screen (none in print). */
  readonly spaced = input(true);

  protected readonly titles = LABEL_TITLES;

  protected size(s: LabelSettings): EnvelopeSize {
    return pageSize(s);
  }

  protected font(s: LabelSettings): string {
    return LABEL_FONT_STACKS[s.font];
  }

  protected postal(code: string, s: LabelSettings): string {
    return postalLine(code, s.postalPrefix);
  }

  protected columns(s: LabelSettings): string {
    return `repeat(${s.columns}, ${s.labelWidthMm}mm)`;
  }
}
