import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { WarningsListComponent } from '../../shared/components/warnings-list/warnings-list.component';
import type { ListGroup } from '../../shared/interfaces/dictionary.interface';
import type { Dashboard } from '../../shared/interfaces/report.interface';
import { UaDatePipe } from '../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../shared/services/auth.service';
import { DictionariesService } from '../../shared/services/dictionaries.service';

const GROUP_ORDER: ListGroup[] = ['G1', 'G1R', 'G2', 'G2R', 'G3', 'G3R', 'G4', 'G4R'];

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, RouterLink, IconComponent, WarningsListComponent, UaDatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly dict = inject(DictionariesService);

  /** Data from dashboardResolver (null — the summary failed to load). */
  readonly dashboard = input<Dashboard | null>(null);
  protected readonly data = computed(() => this.dashboard());

  protected readonly greeting = computed(() => {
    const name = this.auth.user()?.fullName.split(' ')[0];
    return name ? `Вітаємо, ${name}` : 'Огляд';
  });

  protected readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(1, ...GROUP_ORDER.map((g) => d.byGroup[g]));
    return GROUP_ORDER.map((group) => ({
      group,
      title: this.dict.groupTitle(group),
      count: d.byGroup[group],
      share: (d.byGroup[group] / max) * 100,
    }));
  });
}
