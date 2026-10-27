import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  min,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { OrganizationSettingsData } from '../resolvers/settings.resolvers';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { Tck } from '../../../shared/interfaces/dictionary.interface';
import type { Organization } from '../../../shared/interfaces/organization.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';

const EMPTY_ORG: Organization = {
  fullName: '',
  nameLocative: '',
  shortName: '',
  edrpou: '',
  address: '',
  postalCode: '',
  phone: '',
  email: '',
  headPosition: 'Директор',
  headName: '',
  letterNumberPrefix: '',
  alertDays: 30,
  notifyDeadlineDays: 7,
};

@Component({
  selector: 'app-organization-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    UaDatePipe,
    RouterLink,
  ],
  templateUrl: './organization-settings.component.html',
})
export class OrganizationSettingsComponent {
  private readonly organizationService = inject(OrganizationService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly dict = inject(DictionariesService);

  private readonly refresh = injectRouteRefresh();

  /** Company details and responsible persons — from organizationSettingsResolver (parallel requests). */
  readonly settings = input.required<OrganizationSettingsData>();
  protected readonly persons = computed(() => this.settings().responsiblePersons);

  // ---------- company details
  protected readonly orgModel = linkedSignal<Organization>(() => ({
    ...EMPTY_ORG,
    ...this.settings().organization,
  }));
  protected readonly orgForm = form(this.orgModel, (p) => {
    required(p.fullName, { message: 'Вкажіть повну назву' });
    required(p.nameLocative, { message: 'Потрібно для заголовків списків' });
    required(p.shortName, { message: 'Вкажіть скорочену назву' });
    const len = (path: Parameters<typeof maxLength<string>>[0], max: number) =>
      maxLength(path, max, { message: MESSAGE.tooLong(max) });
    len(p.fullName, 500);
    len(p.nameLocative, 500);
    len(p.shortName, 300);
    len(p.edrpou, 10);
    len(p.address, 500);
    validate(p.postalCode, ({ value }) =>
      value() && !/^\d{5}$/.test(value())
        ? { kind: 'postalCode', message: 'Поштовий індекс — 5 цифр' }
        : undefined,
    );
    len(p.phone, 100);
    len(p.email, 200);
    len(p.headPosition, 200);
    len(p.headName, 200);
    len(p.letterNumberPrefix, 30);
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    min(p.alertDays, 1, { message: 'Щонайменше 1 день' });
    min(p.notifyDeadlineDays, 1, { message: 'Щонайменше 1 день' });
    validate(p.edrpou, ({ value }) =>
      value() && !/^\d{8,10}$/.test(value())
        ? { kind: 'edrpou', message: '8 цифр (ЄДРПОУ) або 10 (РНОКПП ФОП)' }
        : undefined,
    );
  });

  protected async saveOrg(event: Event) {
    event.preventDefault();
    await submit(this.orgForm, async () => {
      try {
        const m = this.orgModel();
        await this.organizationService.update({
          ...m,
          alertDays: Number(m.alertDays),
          notifyDeadlineDays: Number(m.notifyDeadlineDays),
        });
        this.toast.success('Реквізити збережено');
        await this.refresh();
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  // ---------- responsible persons
  protected readonly personModel = signal({
    fullName: '',
    position: '',
    phone: '',
    orderNumber: '',
    validFrom: todayIso(),
    validTo: '',
  });
  protected readonly personForm = form(this.personModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я та прізвище' });
    required(p.validFrom, { message: 'Вкажіть дату початку' });
    maxLength(p.fullName, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.position, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.phone, 100, { message: MESSAGE.tooLong(100) });
    maxLength(p.orderNumber, 50, { message: MESSAGE.tooLong(50) });
    validate(p.validTo, ({ value, valueOf }) =>
      value() && value() < valueOf(p.validFrom)
        ? { kind: 'order', message: 'Раніше за дату початку' }
        : undefined,
    );
  });

  protected async addPerson(event: Event) {
    event.preventDefault();
    await submit(this.personForm, async () => {
      try {
        const m = this.personModel();
        await this.organizationService.createResponsible({ ...m, validTo: m.validTo || null });
        this.personModel.set({
          fullName: '',
          position: '',
          phone: '',
          orderNumber: '',
          validFrom: todayIso(),
          validTo: '',
        });
        this.personForm().reset();
        await this.refresh();
        this.toast.success('Додано');
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  protected async removePerson(id: string) {
    try {
      await this.organizationService.removeResponsible(id);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  // ---------- TCK directory
  protected readonly tckFilter = signal('');
  protected readonly tcks = computed(() => {
    const q = this.tckFilter().toLowerCase();
    return this.dict.tcks().filter((t) => !q || t.name.toLowerCase().includes(q));
  });
  protected readonly editingTck = signal<string | null>(null);
  protected readonly tckModel = signal<
    Pick<Tck, 'name' | 'nameGenitive' | 'address' | 'postalCode' | 'phone' | 'email'>
  >({ name: '', nameGenitive: '', address: '', postalCode: '', phone: '', email: '' });
  protected readonly tckForm = form(this.tckModel, (p) => {
    required(p.name, { message: 'Вкажіть назву' });
    maxLength(p.name, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.nameGenitive, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.address, 300, { message: MESSAGE.tooLong(300) });
    validate(p.postalCode, ({ value }) =>
      value() && !/^\d{5}$/.test(value())
        ? { kind: 'postalCode', message: 'Поштовий індекс — 5 цифр' }
        : undefined,
    );
    maxLength(p.phone, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.email, 200, { message: MESSAGE.tooLong(200) });
    validate(p.email, ({ value }) =>
      value() && !/^\S+@\S+\.\S+$/.test(value())
        ? { kind: 'email', message: 'Некоректний email' }
        : undefined,
    );
  });

  protected editTck(t: Tck | null) {
    this.editingTck.set(t?.id ?? 'new');
    this.tckModel.set(
      t
        ? {
            name: t.name,
            nameGenitive: t.nameGenitive,
            address: t.address,
            postalCode: t.postalCode ?? '',
            phone: t.phone,
            email: t.email,
          }
        : { name: '', nameGenitive: '', address: '', postalCode: '', phone: '', email: '' },
    );
    this.tckForm().reset();
  }

  protected async saveTck(event: Event) {
    event.preventDefault();
    await submit(this.tckForm, async () => {
      try {
        const id = this.editingTck();
        await this.dict.saveTck(this.tckModel(), id && id !== 'new' ? id : undefined);
        this.editingTck.set(null);
        await this.dict.reloadTcks();
        this.toast.success('ТЦК збережено');
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }
}
