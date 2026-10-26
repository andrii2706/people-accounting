import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Warning } from '../../interfaces/common.interface';

@Component({
  selector: 'app-warnings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warnings-list.component.html',
})
export class WarningsListComponent {
  readonly warnings = input<Warning[]>([]);
  readonly includeInfo = input(false);
  protected readonly visible = computed(() =>
    this.includeInfo() ? this.warnings() : this.warnings().filter((w) => w.level !== 'info'),
  );
}
