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
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { TckMatchesComponent } from '../../../../shared/components/tck-matches/tck-matches.component';
import type {
  NewTckForm,
  TckChangeForm,
} from '../../../../shared/interfaces/employee-dialogs.interface';
import type { EmployeeDetails } from '../../../../shared/interfaces/employee.interface';
import { AuthService } from '../../../../shared/services/auth.service';
import { DictionariesService } from '../../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../../shared/services/employees.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { formSubmitErrors } from '../../../../shared/utils/api-error.utils';
import { todayIso } from '../../../../shared/utils/date.utils';
import { tckOption } from '../../../../shared/utils/tck.utils';
import { MAX_LENGTH, MESSAGE, PATTERN } from '../../../../shared/validators/employee-rules';

const EMPTY_TCK: NewTckForm = {
  name: '',
  nameGenitive: '',
  postalCode: '',
  address: '',
  phone: '',
  email: '',
};

/**
 * «Змінити ТЦК (місце обліку)»: the new TCK with the day the person was registered there; the address, phone,
 * e-mail and «кому» come from the directory. A TCK missing from the directory is added right here — and the
 * other cards whose document was issued by it are offered to get it too.
 */
@Component({
  selector: 'app-tck-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    FormField,
    FormFieldComponent,
    DateInputComponent,
    SelectComponent,
    IconComponent,
    TckMatchesComponent,
    UiBusyDirective,
  ],
  templateUrl: './tck-dialog.component.html',
})
export class TckDialogComponent {
  private readonly employees = inject(EmployeesService);
  protected readonly dict = inject(DictionariesService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly employee = input.required<EmployeeDetails>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly tckOptions = computed(() =>
    this.dict
      .activeTcks()
      .filter((t) => t.id !== this.employee().tckId)
      .map(tckOption),
  );

  protected readonly model = signal<TckChangeForm>({ tckId: '', tckRegisteredAt: '', basis: '' });
  protected readonly form = form(this.model, (p) => {
    required(p.tckId, { message: 'Оберіть ТЦК' });
    required(p.tckRegisteredAt, { message: 'Вкажіть дату постановки на облік' });
    validate(p.tckRegisteredAt, ({ value }) =>
      value() && value() > todayIso() ? { kind: 'future', message: MESSAGE.futureDate } : undefined,
    );
    maxLength(p.basis, MAX_LENGTH.changeBasis, {
      message: MESSAGE.tooLong(MAX_LENGTH.changeBasis),
    });
  });
  protected readonly saving = signal(false);

  /** The chosen TCK from the directory — what goes into the letters. */
  protected readonly chosen = computed(
    () => this.dict.tcks().find((t) => t.id === this.model().tckId) ?? null,
  );
  protected readonly chosenAddress = computed(() => {
    const t = this.chosen();
    return t ? [t.postalCode, t.address].filter(Boolean).join(', ') : '';
  });
  protected readonly current = computed(() => {
    const e = this.employee();
    const since = e.tckRegisteredAt ? ` з ${e.tckRegisteredAt.split('-').reverse().join('.')}` : '';
    return e.tck ? `${e.tck.name}${since}` : 'не вказано';
  });

  // a TCK that is not in the directory
  protected readonly adding = signal(false);
  protected readonly added = signal<string | null>(null);
  protected readonly tckModel = signal<NewTckForm>({ ...EMPTY_TCK });
  protected readonly tckForm = form(this.tckModel, (p) => {
    required(p.name, { message: 'Вкажіть назву' });
    maxLength(p.name, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.nameGenitive, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.address, 300, { message: MESSAGE.tooLong(300) });
    pattern(p.postalCode, PATTERN.postalCode, { message: MESSAGE.postalCode });
    maxLength(p.phone, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.email, 200, { message: MESSAGE.tooLong(200) });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
  });
  protected readonly savingTck = signal(false);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const e = this.employee();
      untracked(() => {
        // the basis from the newest military document, if there is one
        const doc = [...(e.militaryDocuments ?? [])].sort((a, b) =>
          (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''),
        )[0];
        this.model.set({
          tckId: '',
          tckRegisteredAt: '',
          basis: doc?.issuedAt
            ? `${doc.type || 'військово-обліковий документ'} від ${doc.issuedAt.split('-').reverse().join('.')}`
            : '',
        });
        this.form().reset();
        this.adding.set(false);
        this.added.set(null);
      });
    });
  }

  protected openAdding() {
    this.tckModel.set({ ...EMPTY_TCK });
    this.tckForm().reset();
    this.adding.set(true);
  }

  protected async addTck(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    await submit(this.tckForm, async () => {
      this.savingTck.set(true);
      try {
        const m = this.tckModel();
        const tck = await this.dict.saveTck({
          name: m.name.trim(),
          nameGenitive: m.nameGenitive.trim(),
          postalCode: m.postalCode.trim(),
          address: m.address.trim(),
          phone: m.phone.trim(),
          email: m.email.trim(),
          isActive: true,
        });
        await this.dict.reloadTcks();
        this.model.update((x) => ({ ...x, tckId: tck.id }));
        this.adding.set(false);
        this.added.set(tck.id);
        this.toast.success('ТЦК додано до довідника');
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.tckForm, (message) => this.toast.error(message));
      } finally {
        this.savingTck.set(false);
      }
    });
  }

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.form, async () => {
      const m = this.model();
      this.saving.set(true);
      try {
        await this.employees.update(this.employee().id, {
          tckId: m.tckId,
          tckRegisteredAt: m.tckRegisteredAt,
          changeMeta: { effectiveDate: m.tckRegisteredAt, basis: m.basis.trim() || undefined },
        });
        this.toast.success('ТЦК змінено — попередній лишився в історії картки');
        this.saved.emit();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.form, (message) => this.toast.error(message));
      } finally {
        this.saving.set(false);
      }
    });
  }
}
