import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A part of a page or a small action on its way — the shape of the rows that are coming (daisyUI .skeleton).
 * The busy region says so to screen readers itself (aria-busy on it); the skeleton is hidden from them.
 */
@Component({
  selector: 'ui-skeleton-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'flex flex-col gap-3' },
  template: `
    @for (w of widths(); track $index) {
      <div class="flex items-center gap-3">
        @if (avatar()) {
          <div class="skeleton size-8 shrink-0 rounded-full"></div>
        }
        <div class="flex flex-1 flex-col gap-2">
          <div class="skeleton h-3" [style.width.%]="w"></div>
          @if (lines() > 1) {
            <div class="skeleton h-3" [style.width.%]="w / 2"></div>
          }
        </div>
      </div>
    }
  `,
})
export class UiSkeletonListComponent {
  readonly rows = input(3);
  readonly avatar = input(false);
  readonly lines = input<1 | 2>(2);
  protected readonly widths = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => [70, 55, 80, 45, 65][i % 5]),
  );
}
