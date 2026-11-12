import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { LIST_SECTION_ORDER } from '../../shared/constants/lists.constants';
import type { Dashboard } from '../../shared/interfaces/report.interface';
import { UaDatePipe } from '../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../shared/services/auth.service';
import { DictionariesService } from '../../shared/services/dictionaries.service';
import { InboxService } from '../../shared/services/inbox.service';
import { buildTasks, upcomingTerms } from '../../shared/utils/dashboard-tasks.utils';
import { percentText } from '../../shared/utils/legal-entity.utils';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, UaDatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly dict = inject(DictionariesService);

  /** Data from dashboardResolver (null — the summary failed to load). */
  readonly dashboard = input<Dashboard | null>(null);
  protected readonly data = computed(() => this.dashboard());

  private readonly inbox = inject(InboxService);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const hello =
      hour < 5
        ? 'Доброї ночі'
        : hour < 12
          ? 'Доброго ранку'
          : hour < 18
            ? 'Доброго дня'
            : 'Доброго вечора';
    const name = this.auth.user()?.fullName.split(' ')[0];
    return name ? `${hello}, ${name}` : hello;
  });

  /** «Що зробити сьогодні» — from the same notifications as the bell. */
  protected readonly tasks = computed(() => buildTasks(this.inbox.items()));
  protected readonly visibleTasks = computed(() => this.tasks().slice(0, 7));
  protected readonly urgentCount = computed(
    () => this.tasks().filter((t) => t.level === 'danger').length,
  );
  protected readonly inboxLoaded = this.inbox.loaded;
  protected readonly summary = computed(() => {
    const n = this.tasks().length;
    const word =
      n % 10 === 1 && n % 100 !== 11
        ? 'справа'
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
          ? 'справи'
          : 'справ';
    const urgent = this.urgentCount();
    return `${n} ${word} на сьогодні` + (urgent ? `, з них термінових: ${urgent}` : '');
  });
  protected readonly terms = computed(() => upcomingTerms(this.inbox.items()).slice(0, 6));

  protected day(iso: string) {
    return iso.slice(8, 10);
  }

  protected month(iso: string) {
    return ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'][
      Number(iso.slice(5, 7)) - 1
    ];
  }

  /** The four personal registration lists. */
  protected readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(1, ...LIST_SECTION_ORDER.map((g) => d.bySection[g]));
    const titles = new Map(
      (this.dict.dictionaries()?.listSections ?? []).map((s) => [s.value, s.label]),
    );
    return LIST_SECTION_ORDER.map((section) => ({
      group: section,
      title: titles.get(section) ?? section,
      count: d.bySection[section],
      share: (d.bySection[section] / max) * 100,
    }));
  });

  protected readonly percent = percentText;

  /** Share of the reservation quota used (for the bar). */
  protected readonly quotaShare = computed(() => {
    const r = this.data()?.reservation;
    if (!r?.quota) return 0;
    return Math.min(100, (r.reservedCompany / r.quota) * 100);
  });

  /** Legal entities whose criticality is over — no new reservations under their quota. */
  protected readonly expiredQuotas = computed(() =>
    (this.data()?.reservation.entities ?? []).filter((q) => q.quota !== null && q.expired),
  );
}
