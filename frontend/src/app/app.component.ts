import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHostComponent } from './shared/components/confirm-host/confirm-host.component';
import { SnackbarHostComponent } from './shared/components/snackbar-host/snackbar-host.component';
import { ConfirmService } from './shared/services/confirm.service';
import { ToastService } from './shared/services/toast.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SnackbarHostComponent, ConfirmHostComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly confirm = inject(ConfirmService);
}
