import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mb-6 flex flex-wrap items-end justify-between gap-4' },
  template: `
    <div class="min-w-0">
      @if (eyebrow()) {
        <p class="mb-1 text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase">{{ eyebrow() }}</p>
      }
      <h1 class="text-2xl font-semibold tracking-tight text-ink">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="mt-1 max-w-3xl text-sm text-muted">{{ subtitle() }}</p>
      }
    </div>
    <div class="flex flex-wrap items-center gap-2"><ng-content /></div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
