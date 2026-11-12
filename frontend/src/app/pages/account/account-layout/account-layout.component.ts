import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CopyrightComponent } from '../../../shared/components/copyright/copyright.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthService } from '../../../shared/services/auth.service';

/** A plain frame for the agreement / plans / subscription: the logo, who is signed in, the sign-out. */
@Component({
  selector: 'app-account-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, IconComponent, CopyrightComponent],
  host: { class: 'flex min-h-screen flex-col bg-canvas' },
  templateUrl: './account-layout.component.html',
})
export class AccountLayoutComponent {
  protected readonly auth = inject(AuthService);
}
