import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COPYRIGHT_TEXT } from '../../constants/subscription.constants';

/** «© ТОВ «ПАВ ІТ», 2026» — at the bottom of every page. */
@Component({
  selector: 'app-copyright',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block text-center text-xs text-muted print:hidden' },
  template: `<p>{{ text }}</p>`,
})
export class CopyrightComponent {
  protected readonly text = COPYRIGHT_TEXT;
}
