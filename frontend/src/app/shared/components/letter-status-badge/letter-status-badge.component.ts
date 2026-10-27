import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { LetterStatus } from '../../interfaces/letter.interface';

const STATUS: Record<LetterStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Чернетка', cls: 'bg-sunken text-muted' },
  SENT: { label: 'Надіслано', cls: 'bg-[#e3f1e5] text-ok' },
};

@Component({
  selector: 'app-letter-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './letter-status-badge.component.html',
})
export class LetterStatusBadgeComponent {
  readonly status = input.required<LetterStatus>();
  protected readonly meta = computed(() => STATUS[this.status()]);
}
