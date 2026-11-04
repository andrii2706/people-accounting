import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { REPORT_VIEWS } from '../../constants/lists.constants';
import { IconComponent } from '../icon/icon.component';

/**
 * Switch between the full lists and the extracts for the TCKs — the same data in two views;
 * the date and the legal entity stay as chosen.
 */
@Component({
  selector: 'app-report-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav class="segmented" aria-label="Вигляд списків">
      @for (v of views; track v.path) {
        <a
          class="segmented-item"
          [routerLink]="v.path"
          queryParamsHandling="preserve"
          routerLinkActive="is-active"
          ariaCurrentWhenActive="page"
          [title]="v.hint"
          ><app-icon [name]="v.icon" [size]="15" /> {{ v.label }}</a
        >
      }
    </nav>
  `,
})
export class ReportSwitchComponent {
  protected readonly views = REPORT_VIEWS;
}
