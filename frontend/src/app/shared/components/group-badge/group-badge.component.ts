import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ListGroup } from '../../interfaces/dictionary.interface';

@Component({
  selector: 'app-group-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-badge.component.html',
})
export class GroupBadgeComponent {
  readonly group = input<ListGroup | null>(null);
  readonly title = input('');
}
