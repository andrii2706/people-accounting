import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TwoFactorSetup } from '../../../../platform/contracts/session';
import { qrPath } from '../../utils/two-factor.utils';

/** A QR code drawn from its grid (no image, no outside service): dark on white with the quiet zone. */
@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      class="block size-full rounded-lg bg-white"
      shape-rendering="crispEdges"
      role="img"
      [attr.aria-label]="label()"
    >
      <path [attr.d]="path()" fill="#111" />
    </svg>
  `,
})
export class QrCodeComponent {
  readonly qr = input.required<TwoFactorSetup['qr']>();
  readonly label = input('QR-код');

  protected readonly path = computed(() => qrPath(this.qr()));
  protected readonly viewBox = computed(() => `0 0 ${this.qr().size + 8} ${this.qr().size + 8}`);
}
