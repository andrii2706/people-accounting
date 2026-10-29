import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { WarningsListComponent } from '../../shared/components/warnings-list/warnings-list.component';
import type { ListSection } from '../../shared/interfaces/dictionary.interface';
import type { Dashboard } from '../../shared/interfaces/report.interface';
import { UaDatePipe } from '../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../shared/services/auth.service';
import { DictionariesService } from '../../shared/services/dictionaries.service';

const SECTION_ORDER: ListSection[] = ['OFFICERS', 'SOLDIERS', 'WOMEN', 'CONSCRIPTS'];

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

  /** The four personal registration lists. */
  protected readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(1, ...SECTION_ORDER.map((g) => d.bySection[g]));
    const titles = new Map(
      (this.dict.dictionaries()?.listSections ?? []).map((s) => [s.value, s.label]),
    );
    return SECTION_ORDER.map((section) => ({
      group: section,
      title: titles.get(section) ?? section,
      count: d.bySection[section],
      share: (d.bySection[section] / max) * 100,
    }));
  });

  /** Share of the reservation quota used (for the bar). */
  protected readonly quotaShare = computed(() => {
    const r = this.data()?.reservation;
    if (!r?.quota) return 0;
    return Math.min(100, (r.reservedCompany / r.quota) * 100);
  });
}
