import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AuthService } from '../../shared/services/auth.service';

/** An account that is not bound to a legal entity yet: nothing to show until the main administrator assigns it. */
@Component({
  selector: 'app-no-entity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  templateUrl: './no-entity.component.html',
})
export class NoEntityComponent {
  protected readonly auth = inject(AuthService);
}
