import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LabelSheetComponent } from '../../../shared/components/label-sheet/label-sheet.component';
import {
  ENVELOPE_SIZES,
  PRINT_PAGE_RULES,
} from '../../../shared/constants/label-settings.constants';
import type { LabelPrintData } from '../../../shared/interfaces/label-settings.interface';
import { labelPages, pageRules } from '../../../shared/utils/label-settings.utils';

/**
 * Envelope labels for the printer of the browser: each legal entity with its settings,
 * the paper size (A4 or the envelope) is set by @page, the print dialog opens by itself.
 */
@Component({
  selector: 'app-label-print',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LabelSheetComponent],
  host: { class: 'block min-h-screen bg-sunken print:bg-white' },
  templateUrl: './label-print.component.html',
})
export class LabelPrintComponent {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** labelPrintResolver */
  readonly data = input.required<LabelPrintData>();
  /** Where «Назад» leads (after a test print — the settings). */
  readonly back = input('');

  protected readonly pages = computed(() => labelPages(this.data().groups));
  protected readonly count = computed(() =>
    this.data().groups.reduce((n, g) => n + g.labels.length, 0),
  );
  /** Envelope formats among the groups — the hint reminds to load them. */
  protected readonly envelopes = computed(() => [
    ...new Set(
      this.data()
        .groups.filter((g) => g.settings.mode === 'ENVELOPE')
        .map((g) => {
          const size = ENVELOPE_SIZES[g.settings.envelope];
          return `${g.settings.envelope} (${size.widthMm}×${size.heightMm} мм)`;
        }),
    ),
  ]);
  protected readonly hasSheets = computed(() =>
    this.data().groups.some((g) => g.settings.mode === 'SHEET'),
  );

  constructor() {
    const style = this.document.createElement('style');
    afterNextRender(() => {
      style.textContent = `${pageRules(this.data().groups)}\n${PRINT_PAGE_RULES}`;
      this.document.head.appendChild(style);
      // after the fonts — otherwise the first print may take the fallback font
      void this.document.fonts.ready.then(() => this.print());
    });
    inject(DestroyRef).onDestroy(() => style.remove());
  }

  protected print() {
    this.document.defaultView?.print();
  }

  /** Back to the settings after a test print; a tab opened from the letters closes (or shows the letters). */
  protected close() {
    if (this.back()) {
      void this.router.navigateByUrl(this.back());
      return;
    }
    const view = this.document.defaultView;
    // a browser closes only a tab with no history of its own; otherwise — to the letters
    if (view && view.history.length <= 1) view.close();
    setTimeout(() => void this.router.navigateByUrl('/letters'), 100);
  }
}
