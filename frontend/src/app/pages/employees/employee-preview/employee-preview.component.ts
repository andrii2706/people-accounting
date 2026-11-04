import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryBadgeComponent } from '../../../shared/components/category-badge/category-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type {
  EmployeeDetails,
  EmployeeListItem,
} from '../../../shared/interfaces/employee.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { PhonePipe } from '../../../shared/pipes/phone.pipe';
import { initials, statusBadges } from '../../../shared/utils/employee-list.utils';

/** Side panel of the employee list: the main facts of a card without leaving the list. */
@Component({
  selector: 'app-employee-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, CategoryBadgeComponent, UaDatePipe, PhonePipe],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './employee-preview.component.html',
})
export class EmployeePreviewComponent {
  /** The row of the list — shown at once; the details arrive a moment later. */
  readonly item = input.required<EmployeeListItem>();
  readonly closed = output<void>();

  protected readonly details = httpResource<EmployeeDetails>(
    () => `/api/employees/${this.item().id}`,
  );
  protected readonly d = computed(() => (this.details.hasValue() ? this.details.value() : null));

  /** Texts of the warnings come with the card (the list carries only codes). */
  protected readonly warnings = computed(() =>
    (this.d()?.derived.warnings ?? []).filter((w) => w.level !== 'info'),
  );
  protected readonly badges = computed(() => statusBadges(this.item()));
  protected readonly initials = computed(() => initials(this.item()));
  protected readonly documents = computed(() =>
    (this.d()?.militaryDocuments ?? [])
      .map((doc) =>
        [doc.type, doc.series && `серія ${doc.series}`, doc.number && `№ ${doc.number}`]
          .filter(Boolean)
          .join(' '),
      )
      .filter(Boolean),
  );
  /** The latest changes of the card (newest first). */
  protected readonly changes = computed(() =>
    [...(this.d()?.changes ?? [])]
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
      .slice(0, 3),
  );
}
