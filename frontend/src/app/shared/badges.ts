import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DutyCategory, LetterStatus, ListGroup, Warning } from '../core/api/api.types';

const CATEGORY: Record<DutyCategory, { label: string; cls: string }> = {
  LIABLE: { label: 'Військовозобов’язаний', cls: 'bg-brand-100 text-brand-700' },
  RESERVIST: { label: 'Резервіст', cls: 'bg-[#e6eef7] text-info' },
  CONSCRIPT: { label: 'Призовник', cls: 'bg-[#f6ecdf] text-warning' },
};

@Component({
  selector: 'app-category-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta(); as m) {
      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap" [class]="m.cls">{{ m.label }}</span>
    } @else {
      <span class="text-xs text-muted">не на обліку</span>
    }
  `,
})
export class CategoryBadge {
  readonly category = input<DutyCategory | null>(null);
  protected readonly meta = computed(() => {
    const c = this.category();
    return c ? CATEGORY[c] : null;
  });
}

@Component({
  selector: 'app-group-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group()) {
      <span class="inline-flex rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink" [title]="title()">{{ group() }}</span>
    }
  `,
})
export class GroupBadge {
  readonly group = input<ListGroup | null>(null);
  readonly title = input('');
}

const STATUS: Record<LetterStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Чернетка', cls: 'bg-sunken text-muted' },
  SENT: { label: 'Надіслано', cls: 'bg-[#e3f1e5] text-ok' },
  FAILED: { label: 'Помилка відправки', cls: 'bg-[#fbe9e7] text-danger' },
};

@Component({
  selector: 'app-letter-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap" [class]="meta().cls">{{ meta().label }}</span>`,
})
export class LetterStatusBadge {
  readonly status = input.required<LetterStatus>();
  protected readonly meta = computed(() => STATUS[this.status()]);
}

@Component({
  selector: 'app-warnings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-1">
      @for (w of visible(); track w.code) {
        <li class="flex items-start gap-1.5 text-xs" [class]="w.level === 'danger' ? 'text-danger' : w.level === 'warning' ? 'text-warning' : 'text-muted'">
          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-current"></span>{{ w.message }}
        </li>
      }
    </ul>
  `,
})
export class WarningsList {
  readonly warnings = input<Warning[]>([]);
  readonly includeInfo = input(false);
  protected readonly visible = computed(() =>
    this.includeInfo() ? this.warnings() : this.warnings().filter((w) => w.level !== 'info'),
  );
}
