import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DutyCategory } from '../../interfaces/dictionary.interface';

const CATEGORY: Record<DutyCategory, { label: string; cls: string }> = {
  LIABLE: { label: 'Військовозобов’язаний', cls: 'bg-brand-100 text-brand-700' },
  RESERVIST: { label: 'Резервіст', cls: 'bg-[#e6eef7] text-info' },
  CONSCRIPT: { label: 'Призовник', cls: 'bg-[#f6ecdf] text-warning' },
};

@Component({
  selector: 'app-category-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-badge.component.html',
})
export class CategoryBadgeComponent {
  readonly category = input<DutyCategory | null>(null);
  protected readonly meta = computed(() => {
    const c = this.category();
    return c ? CATEGORY[c] : null;
  });
}
