import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DUTY_CATEGORY_BADGES } from '../../constants/badges.constants';
import type { DutyCategory } from '../../interfaces/dictionary.interface';

@Component({
  selector: 'app-category-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-badge.component.html',
})
export class CategoryBadgeComponent {
  readonly category = input<DutyCategory | null>(null);
  /** Text instead of the default one, e.g. «військовозобов’язана» from the list cell. */
  readonly label = input('');
  protected readonly meta = computed(() => {
    const c = this.category();
    return c ? DUTY_CATEGORY_BADGES[c] : null;
  });
}
