import { AuthService } from '../../../shared/services/auth.service';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ReportSwitchComponent } from '../../../shared/components/report-switch/report-switch.component';
import { LegalEntityFilterComponent } from '../../../shared/components/legal-entity-filter/legal-entity-filter.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EXTRACT_SECTIONS, LIST_SECTION_ORDER } from '../../../shared/constants/lists.constants';
import type { ListSection } from '../../../shared/interfaces/dictionary.interface';
import type { TckExtractSummary } from '../../../shared/interfaces/report.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { LettersService } from '../../../shared/services/letters.service';
import { NavigationStateService } from '../../../shared/services/navigation-state.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { extractCount, groupsOfSections } from '../../../shared/utils/lists-view.utils';
import { injectQueryParamsUpdate, orEmpty } from '../../../shared/utils/router.utils';

/**
 * Extracts from the lists for every TCK: each TCK gets «ВИТЯГ ІЗ СПИСКІВ» only about the people
 * registered there — officers, liable for service (rank-and-file), women, conscripts.
 */
@Component({
  selector: 'app-extracts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DateInputComponent,
    PageHeaderComponent,
    IconComponent,
    LegalEntityFilterComponent,
    ReportSwitchComponent,
  ],
  templateUrl: './extracts.component.html',
})
export class ExtractsComponent {
  protected readonly auth = inject(AuthService);
  private readonly reportsService = inject(ReportsService);
  private readonly lettersService = inject(LettersService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dict = inject(DictionariesService);
  private readonly updateQuery = injectQueryParamsUpdate();
  protected readonly isLoading = inject(NavigationStateService).isNavigating;

  /** extractsResolver */
  readonly extracts = input.required<TckExtractSummary[]>();
  readonly date = input<string, string | undefined>('', { transform: orEmpty });
  readonly entity = input<string, string | undefined>('', { transform: orEmpty });

  protected readonly today = todayIso();
  protected readonly reportDate = computed(() => this.date() || this.today);
  protected readonly sectionOptions = EXTRACT_SECTIONS;
  protected readonly sectionOrder = LIST_SECTION_ORDER;
  /** Which lists go into the extracts (all four by default). */
  protected readonly sections = signal<ReadonlySet<ListSection>>(new Set(LIST_SECTION_ORDER));
  protected readonly needsEntity = computed(
    () => this.dict.severalLegalEntities() && !this.entity(),
  );

  protected readonly rows = computed(() =>
    this.extracts().map((item) => ({ item, count: extractCount(item, this.sections()) })),
  );
  protected readonly totals = computed(() => {
    const totals = Object.fromEntries(LIST_SECTION_ORDER.map((s) => [s, 0])) as Record<
      ListSection,
      number
    >;
    for (const { item } of this.rows())
      for (const s of LIST_SECTION_ORDER) totals[s] += item.sections[s];
    return totals;
  });
  protected readonly busyTck = signal<string | null>(null);

  protected setDate(date: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    void this.updateQuery({ date: date && date !== this.today ? date : '' });
  }

  protected setEntity(entity: string) {
    void this.updateQuery({ entity });
  }

  protected toggleSection(section: ListSection) {
    this.sections.update((set) => {
      const next = new Set(set);
      if (!next.delete(section)) next.add(section);
      return next.size ? next : set;
    });
  }

  /** The extract for one TCK: the chosen lists, or only `section`. */
  protected docxUrl(tckId: string, section?: ListSection) {
    return this.reportsService.listsDocxUrl({
      date: this.reportDate(),
      tck: tckId,
      groups: groupsOfSections(section ? new Set([section]) : this.sections()),
      entity: this.entity(),
    });
  }

  /** Registers the extract as an outgoing letter to the TCK — it gets a number and a date. */
  protected async register(item: TckExtractSummary) {
    if (!item.tckId) return;
    this.busyTck.set(item.tckId);
    try {
      const groups = groupsOfSections(this.sections());
      const letter = await this.lettersService.createReport({
        type: 'LISTS',
        reportDate: this.reportDate(),
        tckId: item.tckId,
        byTck: true,
        groups: groups.length ? groups : undefined,
        legalEntityId: this.entity() || undefined,
      });
      this.toast.success(`Витяг для ${item.tckName}: вих. № ${letter.number}`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busyTck.set(null);
    }
  }
}
