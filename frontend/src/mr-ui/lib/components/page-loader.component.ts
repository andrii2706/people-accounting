import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A whole page (or a window) on its way: one daisyUI ball in the colour of the module and what is happening.
 * Show it through delayedBusy() so a fast answer shows nothing:
 *
 *   protected readonly loading = delayedBusy(computed(() => this.board.isLoading() && !this.board.hasValue()));
 *   @if (loading()) { <ui-page-loader label="Відкриваємо дошку…" /> } @else if (board.value(); as b) { … }
 */
@Component({
  selector: 'ui-page-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    class: 'flex flex-col items-center justify-center gap-3 py-16 text-center',
    '[class.min-h-[50vh]]': 'full()',
  },
  template: `
    <span
      class="loading loading-ball text-primary"
      [class.loading-xl]="size() === 'xl'"
      [class.loading-lg]="size() === 'lg'"
      aria-hidden="true"
    ></span>
    <span class="text-sm text-muted">{{ label() }}</span>
  `,
})
export class UiPageLoaderComponent {
  readonly label = input('Завантаження…');
  readonly size = input<'lg' | 'xl'>('xl');
  /** takes half of the screen — for a page; off inside a card or a window */
  readonly full = input(true);
}
