import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IconComponent } from './shared/components/icon/icon.component';
import { ToastService } from './shared/services/toast.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, IconComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly toasts = inject(ToastService);
}
