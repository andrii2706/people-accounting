import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { InboxItem } from '../../interfaces/inbox.interface';
import { INBOX_KIND_LABELS } from '../../constants/badges.constants';
import { IconComponent } from '../icon/icon.component';

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

  protected readonly kindLabels = INBOX_KIND_LABELS;
}
