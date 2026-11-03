import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LETTER_STATUS_BADGES } from '../../constants/badges.constants';
import type { LetterStatus } from '../../interfaces/letter.interface';

@Component({
  selector: 'app-letter-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './letter-status-badge.component.html',
})
export class LetterStatusBadgeComponent {
  readonly status = input.required<LetterStatus>();
  protected readonly meta = computed(() => LETTER_STATUS_BADGES[this.status()]);
}
