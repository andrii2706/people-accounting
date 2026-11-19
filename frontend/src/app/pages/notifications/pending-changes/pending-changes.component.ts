import { AuthService } from '../../../shared/services/auth.service';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { PendingChange } from '../../../shared/interfaces/employee.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { LettersService } from '../../../shared/services/letters.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { externalNoticeType } from '../../../shared/utils/letter.utils';
import { isoToDisplay, todayIso } from '../../../shared/utils/date.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import type {
  NoticeRecordForm,
  PendingChangesGroup,
} from '../../../shared/interfaces/letter.interface';

@Component({
  selector: 'app-pending-changes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    RouterLink,
    IconComponent,
    UaDatePipe,
    FormField,
    FormFieldComponent,
    DateInputComponent,
  ],
  templateUrl: './pending-changes.component.html',
})
export class PendingChangesComponent {
  protected readonly auth = inject(AuthService);
  private readonly lettersService = inject(LettersService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();

  readonly pending = input.required<PendingChange[]>();
  protected readonly busy = signal<string | null>(null);
  /** Employees selected for a combined notice. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedCount = computed(
    () => this.groups().filter((g) => this.selected().has(g.employeeId)).length,
  );
  protected readonly allSelected = computed(
    () => this.groups().length > 0 && this.selectedCount() === this.groups().length,
  );
  /** How many letters a combined notice will produce (one per TCK). */
  protected readonly selectedTckCount = computed(
    () =>
      new Set(
        this.groups()
          .filter((g) => this.selected().has(g.employeeId))
          .map((g) => g.tckId ?? 'none'),
      ).size,
  );

  /** Grouped by employee; overdue ones first. */
  protected readonly groups = computed<PendingChangesGroup[]>(() => {
    const map = new Map<string, PendingChangesGroup>();
    for (const c of this.pending()) {
      const g = map.get(c.employee.id) ?? {
        employeeId: c.employee.id,
        fullName: c.employee.fullName,
        tckId: c.employee.tckId,
        tckName: c.employee.tckName,
        overdue: false,
        changes: [],
      };
      g.changes.push(c);
      g.overdue ||= c.overdue;
      map.set(c.employee.id, g);
    }
    return [...map.values()].sort(
      (a, b) => Number(b.overdue) - Number(a.overdue) || a.fullName.localeCompare(b.fullName, 'uk'),
    );
  });

  protected toggle(employeeId: string, checked: boolean) {
    this.selected.update((set) => {
      const next = new Set(set);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  }

  protected toggleAll(checked: boolean) {
    this.selected.set(checked ? new Set(this.groups().map((g) => g.employeeId)) : new Set());
  }

  /** One request for all selected employees; the server groups them by TCK. */
  protected async createForSelected() {
    const ids = this.groups()
      .filter((g) => this.selected().has(g.employeeId))
      .map((g) => g.employeeId);
    if (!ids.length) return;
    this.busy.set('selected');
    try {
      const letters = await this.lettersService.createChangeNotices(ids);
      this.selected.set(new Set());
      if (letters.length === 1) {
        this.toast.success(`Лист вих. № ${letters[0].number} сформовано`);
        await this.router.navigate(['/letters', letters[0].id]);
      } else {
        this.toast.success(
          `Сформовано листів: ${letters.length} (по одному на ТЦК): № ${letters.map((l) => l.number).join(', ')}`,
        );
        await this.router.navigate(['/letters'], { queryParams: { type: 'CHANGE_NOTICE' } });
      }
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * «№ і дата»: the notice about this change was sent outside the app (on paper, through another system) —
   * its outgoing number and date are recorded, and the change leaves the queue with them.
   */
  protected readonly recording = signal<PendingChange | null>(null);
  protected readonly recordModel = signal<NoticeRecordForm>({ number: '', date: todayIso() });
  protected readonly recordForm = form(this.recordModel, (p) => {
    required(p.number, { message: 'Вкажіть номер повідомлення' });
    maxLength(p.number, 50, { message: 'Не більше 50 символів' });
    required(p.date, { message: 'Вкажіть дату повідомлення' });
    validate(p.date, ({ value }) =>
      value() && value() > todayIso()
        ? { kind: 'future', message: 'Дата ще не настала' }
        : undefined,
    );
  });

  protected openRecord(c: PendingChange) {
    this.recordModel.set({ number: '', date: todayIso() });
    this.recording.set(this.recording()?.id === c.id ? null : c);
  }

  protected async saveRecord(event: Event, g: PendingChangesGroup) {
    event.preventDefault();
    const c = this.recording();
    if (!c) return;
    await submit(this.recordForm, async () => {
      try {
        const { number, date } = this.recordModel();
        await this.lettersService.createExternalNotice({
          employeeId: g.employeeId,
          number: number.trim(),
          date,
          changeType: externalNoticeType(c.type),
          effectiveDate: c.effectiveDate,
          tckId: g.tckId ?? undefined,
          description: [c.typeLabel, c.newValue].filter(Boolean).join(': ').slice(0, 1000),
          changeIds: [c.id],
        });
        this.toast.success(
          `Зафіксовано: повідомлення № ${number.trim()} від ${isoToDisplay(date)}`,
        );
        this.recording.set(null);
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.recordForm, (m) => this.toast.error(m));
      }
    });
  }

  protected async createLetter(g: PendingChangesGroup) {
    this.busy.set(g.employeeId);
    try {
      const letter = await this.lettersService.createChangeNotice(g.employeeId);
      this.toast.success(`Лист вих. № ${letter.number} сформовано`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(null);
    }
  }
}
