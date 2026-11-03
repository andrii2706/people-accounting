import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { InboxItem, InboxKind } from '../../interfaces/inbox.interface';
import { IconComponent } from '../icon/icon.component';

const KIND_LABELS: Record<InboxKind, string> = {
  DEADLINE: 'Строки',
  TCK: 'Повідомлення ТЦК',
  CARD: 'Дані картки',
};

/** List of in-app notifications: used in the bell panel and in the window after login. */
@Component({
  selector: 'app-inbox-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './inbox-list.component.html',
})
export class InboxListComponent {
  readonly items = input.required<InboxItem[]>();
  /** Opens the employee card / the TCK notices page (and marks the item read). */
  readonly open = output<InboxItem>();
  readonly markRead = output<InboxItem>();

  protected readonly kindLabels = KIND_LABELS;
}
