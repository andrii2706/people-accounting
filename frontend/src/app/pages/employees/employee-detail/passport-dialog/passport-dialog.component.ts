import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { UiBusyDirective } from '@mr/ui';
import { DateInputComponent } from '../../../../shared/components/date-input/date-input.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import type {
  NoticeDraftInfo,
  PassportChangeForm,
} from '../../../../shared/interfaces/employee-dialogs.interface';
import type {
  EmployeeDetails,
  PendingChange,
} from '../../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../../shared/services/employees.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { formSubmitErrors } from '../../../../shared/utils/api-error.utils';
import { todayIso } from '../../../../shared/utils/date.utils';
import { noticeDraftInfo } from '../../../../shared/utils/notice-letter.utils';
import { MAX_LENGTH, MESSAGE, PATTERN } from '../../../../shared/validators/employee-rules';

/**
 * «Новий паспорт»: the new passport replaces the old one (which stays in the history), and the notice to the TCK
 * about it is queued at once — into the combined letter of the employee's TCK.
 */
@Component({
  selector: 'app-passport-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    FormField,
    FormFieldComponent,
    DateInputComponent,
    IconComponent,
    UiBusyDirective,
  ],
  templateUrl: './passport-dialog.component.html',
})
export class PassportDialogComponent {
  private readonly employees = inject(EmployeesService);
  private readonly toast = inject(ToastService);

  readonly employee = input.required<EmployeeDetails>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  /** What is already waiting for the letter to the employee's TCK. */
  protected readonly pending = httpResource<PendingChange[]>(
    () => (this.open() ? 'api/employees/changes/pending' : undefined),
    { defaultValue: [] },
  );
  protected readonly draft = computed<NoticeDraftInfo | null>(() =>
    noticeDraftInfo(this.pending.value(), this.employee()),
  );

  protected readonly model = signal<PassportChangeForm>(this.empty(null));
  protected readonly isIdCard = computed(() => this.model().passportType === 'ID_CARD');
  protected readonly form = form(this.model, (p) => {
    disabled(p.passportSeries, ({ valueOf }) =>
      valueOf(p.passportType) === 'ID_CARD' ? 'У ID-картки серії немає' : false,
    );
    required(p.passportSeries, {
      message: MESSAGE.passportBookSeries,
      when: ({ valueOf }) => valueOf(p.passportType) === 'BOOK',
    });
    pattern(p.passportSeries, PATTERN.passportBookSeries, {
      message: MESSAGE.passportBookSeries,
      when: ({ valueOf }) => valueOf(p.passportType) === 'BOOK',
    });
    required(p.passportNumber, { message: 'Вкажіть номер паспорта' });
    pattern(p.passportNumber, PATTERN.idCardNumber, {
      message: MESSAGE.idCardNumber,
      when: ({ valueOf }) => valueOf(p.passportType) === 'ID_CARD',
    });
    pattern(p.passportNumber, PATTERN.passportBookNumber, {
      message: MESSAGE.passportBookNumber,
      when: ({ valueOf }) => valueOf(p.passportType) === 'BOOK',
    });
    required(p.passportIssuedBy, { message: 'Вкажіть, ким виданий' });
    pattern(p.passportIssuedBy, PATTERN.idCardIssuer, {
      message: MESSAGE.idCardIssuer,
      when: ({ valueOf }) => valueOf(p.passportType) === 'ID_CARD',
    });
    maxLength(p.passportIssuedBy, MAX_LENGTH.passportIssuedBy, {
      message: MESSAGE.tooLong(MAX_LENGTH.passportIssuedBy),
    });
    required(p.passportIssuedAt, { message: 'Вкажіть дату видачі' });
    validate(p.passportIssuedAt, ({ value }) =>
      value() && value() > todayIso() ? { kind: 'future', message: MESSAGE.futureDate } : undefined,
    );
    required(p.effectiveDate, { message: 'Вкажіть дату зміни' });
    validate(p.effectiveDate, ({ value }) =>
      value() && value() > todayIso() ? { kind: 'future', message: MESSAGE.futureDate } : undefined,
    );
    maxLength(p.basis, MAX_LENGTH.changeBasis, {
      message: MESSAGE.tooLong(MAX_LENGTH.changeBasis),
    });
  });
  protected readonly saving = signal(false);

  protected readonly current = computed(() => {
    const e = this.employee();
    if (!e.passportNumber) return 'не вказано';
    const d = (v: string | null) => (v ? v.split('-').reverse().join('.') : '');
    return [
      e.passportType === 'ID_CARD' ? 'ID-картка' : 'книжечка',
      e.passportSeries,
      `№ ${e.passportNumber}`,
      d(e.passportIssuedAt),
      e.passportIssuedBy,
    ]
      .filter(Boolean)
      .join(' · ');
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const e = this.employee();
      untracked(() => {
        this.model.set(this.empty(e));
        this.form().reset();
      });
    });
    // the day of the change is usually the day the passport was issued
    let lastIssued = '';
    effect(() => {
      const issued = this.model().passportIssuedAt;
      if (issued === lastIssued) return;
      const before = lastIssued;
      lastIssued = issued;
      untracked(() => {
        const m = this.model();
        if (issued && (!m.effectiveDate || m.effectiveDate === before)) {
          this.model.set({ ...m, effectiveDate: issued });
        }
      });
    });
  }

  protected setType(type: 'ID_CARD' | 'BOOK') {
    this.model.update((m) => ({
      ...m,
      passportType: type,
      passportSeries: type === 'ID_CARD' ? '' : m.passportSeries,
    }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.form, async () => {
      const m = this.model();
      this.saving.set(true);
      try {
        const kind = m.passportType === 'ID_CARD' ? 'ID-картка' : 'паспорт-книжечка';
        await this.employees.update(this.employee().id, {
          passportType: m.passportType,
          passportSeries: m.passportType === 'ID_CARD' ? '' : m.passportSeries.trim().toUpperCase(),
          passportNumber: m.passportNumber.trim(),
          passportIssuedBy: m.passportIssuedBy.trim(),
          passportIssuedAt: m.passportIssuedAt,
          changeMeta: {
            effectiveDate: m.effectiveDate,
            basis: m.basis.trim() || `${kind} № ${m.passportNumber.trim()}`,
            notify: m.notify,
          },
        });
        const tck = this.draft()?.tckName;
        this.toast.success(
          m.notify
            ? `Паспорт змінено · повідомлення додано до листа${tck ? ` до ${tck}` : ''}`
            : 'Паспорт змінено',
        );
        this.saved.emit();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.form, (message) => this.toast.error(message));
      } finally {
        this.saving.set(false);
      }
    });
  }

  private empty(e: EmployeeDetails | null): PassportChangeForm {
    return {
      passportType: e?.passportType ?? 'ID_CARD',
      passportSeries: '',
      passportNumber: '',
      passportIssuedBy: '',
      passportIssuedAt: '',
      effectiveDate: '',
      basis: '',
      notify: true,
    };
  }
}
