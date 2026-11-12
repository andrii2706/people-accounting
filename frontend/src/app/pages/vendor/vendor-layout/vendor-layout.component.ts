import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CopyrightComponent } from '../../../shared/components/copyright/copyright.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthService } from '../../../shared/services/auth.service';

/** The vendor's area: the debt, the prices and requisites, the subscriptions and invoices. */
@Component({
  selector: 'app-vendor-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, CopyrightComponent],
  host: { class: 'flex min-h-screen flex-col bg-canvas' },
  templateUrl: './vendor-layout.component.html',
})
export class VendorLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly tabs = [
    { path: '/vendor', label: 'Заборгованість', exact: true },
    { path: '/vendor/subscriptions', label: 'Підписки й рахунки', exact: false },
    { path: '/vendor/pricing', label: 'Тарифи та реквізити', exact: false },
  ];
}
