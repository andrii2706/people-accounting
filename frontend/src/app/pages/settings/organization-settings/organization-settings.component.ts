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
  max,
  maxLength,
  min,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { Tck } from '../../../shared/interfaces/dictionary.interface';
import type {
  NotificationStatus,
  Organization,
  PendingTckImport,
  TckImportFile,
  TckImportItem,
  OrganizationExtraForm,
  OrganizationSettingsData,
} from '../../../shared/interfaces/organization.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';
import { wholeDays } from '../../../shared/validators/organization.validators';
import { EMPTY_ORG, REQUISITE_FIELDS } from '../../../shared/constants/organization.constants';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

@Component({
  selector: 'app-organization-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DateInputComponent,
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
  /** API errors that have no field on the form go to a toast. */
  private readonly notifyError = (message: string) => this.toast.error(message);

  /** Company details and responsible persons — from organizationSettingsResolver (parallel requests). */
  readonly settings = input.required<OrganizationSettingsData>();
  protected readonly persons = computed(() => this.settings().responsiblePersons);
  protected readonly heads = computed(() => this.settings().heads);
  protected readonly today = todayIso();
  /** The head who signs today (a head appointed from a future date is not yet current). */
  protected readonly currentHeadId = computed(() => {
    const today = todayIso();
    return this.heads().find((h) => h.validFrom <= today && (!h.validTo || h.validTo >= today))?.id;
  });
  /** Status of e-mail and the mobilization term; refreshed after «Перевірити укази». */
  protected readonly status = linkedSignal<NotificationStatus>(() => this.settings().status);

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
    pattern(p.postalCode, PATTERN.postalCode, { message: MESSAGE.postalCode });
    len(p.phone, 100);
    len(p.email, 200);
    len(p.headPosition, 200);
    len(p.headName, 200);
    len(p.letterNumberPrefix, 30);
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    required(p.alertDays, { message: 'Вкажіть кількість днів' });
    required(p.notifyDeadlineDays, { message: 'Вкажіть кількість днів' });
    min(p.alertDays, 1, { message: 'Щонайменше 1 день' });
    max(p.alertDays, 365, { message: 'Не більше 365 днів' });
    min(p.notifyDeadlineDays, 1, { message: 'Щонайменше 1 день' });
    max(p.notifyDeadlineDays, 60, { message: 'Не більше 60 днів' });
    validate(p.alertDays, ({ value }) => wholeDays(value()));
    validate(p.notifyDeadlineDays, ({ value }) => wholeDays(value()));
    pattern(p.edrpou, PATTERN.companyCode, { message: MESSAGE.companyCode });
  });

  protected async saveOrg(event: Event) {
    event.preventDefault();
    await submit(this.orgForm, async () => {
      try {
        // Only the requisites of this card are sent: the head has its own card (with history), quota,
        // mobilization and e-mails are saved by theirs, and server fields (id, updatedAt…) are not editable.
        const m = this.orgModel();
        const body: Partial<Organization> = {};
        for (const key of REQUISITE_FIELDS) body[key] = (m[key] ?? '').trim();
        await this.organizationService.update({
          ...body,
          alertDays: Number(m.alertDays),
          notifyDeadlineDays: Number(m.notifyDeadlineDays),
        });
        this.toast.success('Реквізити збережено');
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.orgForm, this.notifyError);
      }
    });
  }

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
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.personForm, this.notifyError);
      }
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

  private emptyHead() {
    return { position: 'Директор', fullName: '', orderNumber: '', validFrom: todayIso() };
  }
  protected readonly headModel = signal(this.emptyHead());
  protected readonly headForm = form(this.headModel, (p) => {
    required(p.position, { message: 'Вкажіть посаду' });
    required(p.fullName, { message: 'Вкажіть ім’я та ПРІЗВИЩЕ' });
    required(p.validFrom, { message: 'Вкажіть дату' });
    maxLength(p.position, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.fullName, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.orderNumber, 50, { message: MESSAGE.tooLong(50) });
  });

  protected async addHead(event: Event) {
    event.preventDefault();
    await submit(this.headForm, async () => {
      try {
        await this.organizationService.createHead({ ...this.headModel(), validTo: null });
        this.headModel.set(this.emptyHead());
        this.headForm().reset();
        await this.refresh();
        this.toast.success('Керівника змінено. Користувачам надіслано сповіщення.');
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.headForm, this.notifyError);
      }
    });
  }

  protected async removeHead(id: string) {
    try {
      await this.organizationService.removeHead(id);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  protected readonly extraModel = linkedSignal<OrganizationExtraForm>(() => {
    const o = this.settings().organization;
    return {
      reservationQuota: o.reservationQuota == null ? '' : String(o.reservationQuota),
      reservationQuotaBasis: o.reservationQuotaBasis ?? '',
      mobilizationUntil: o.mobilizationUntil ?? '',
      mobilizationDecree: o.mobilizationDecree ?? '',
      notifyEmails: o.notifyEmails ?? '',
    };
  });
  protected readonly extraForm = form(this.extraModel, (p) => {
    validate(p.reservationQuota, ({ value }) => {
      const v = value().trim();
      if (!v) return undefined;
      if (!/^\d+$/.test(v)) return { kind: 'quota', message: 'Ціле число без пробілів, напр. 25' };
      return Number(v) > 100_000 ? { kind: 'quota', message: 'Не більше 100 000' } : undefined;
    });
    maxLength(p.reservationQuotaBasis, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.mobilizationDecree, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.notifyEmails, 500, { message: MESSAGE.tooLong(500) });
    validate(p.notifyEmails, ({ value }) =>
      value()
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .every((x) => PATTERN.email.test(x))
        ? undefined
        : { kind: 'emails', message: MESSAGE.emailList },
    );
  });
  protected readonly savingExtra = signal(false);

  private async saveExtra(fields: (keyof OrganizationExtraForm)[], ok: string) {
    const f = this.extraForm;
    for (const k of fields) f[k]().markAsTouched();
    if (fields.some((k) => f[k]().invalid())) return;
    const m = this.extraModel();
    const body: Partial<Organization> = {};
    for (const k of fields) {
      if (k === 'reservationQuota') {
        body.reservationQuota = m.reservationQuota.trim() ? Number(m.reservationQuota) : null;
      } else if (k === 'mobilizationUntil') {
        body.mobilizationUntil = m.mobilizationUntil || null;
      } else {
        body[k] = m[k].trim();
      }
    }
    this.savingExtra.set(true);
    try {
      await this.organizationService.update(body);
      this.toast.success(ok);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.savingExtra.set(false);
    }
  }

  protected saveQuota() {
    return this.saveExtra(['reservationQuota', 'reservationQuotaBasis'], 'Квоту збережено');
  }

  protected saveMobilization() {
    return this.saveExtra(
      ['mobilizationUntil', 'mobilizationDecree'],
      'Строк мобілізації збережено',
    );
  }

  protected saveNotifyEmails() {
    return this.saveExtra(['notifyEmails'], 'Адреси збережено');
  }

  protected readonly checkingDecrees = signal(false);
  protected async checkDecrees() {
    this.checkingDecrees.set(true);
    try {
      const r = await this.organizationService.checkDecrees();
      if (r.ok) {
        this.toast.success(
          r.changed ? 'Знайдено новий указ — строк мобілізації оновлено' : 'Строк не змінився',
        );
        await this.refresh();
      } else {
        this.toast.error(r.message ?? 'Не вдалося перевірити укази');
      }
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.checkingDecrees.set(false);
    }
  }

  protected readonly testingMail = signal(false);
  protected async testMail() {
    this.testingMail.set(true);
    try {
      const { sent } = await this.organizationService.testMail();
      if (sent) this.toast.success(`Тестовий лист надіслано на ${this.auth.user()?.email ?? ''}`);
      else this.toast.error('Пошту не налаштовано (SMTP_URL) — лист не надіслано');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.testingMail.set(false);
    }
  }

  // TCK import file is produced by `npm run tck:export`
  protected readonly tckImport = signal<PendingTckImport | null>(null);
  protected readonly importingTck = signal(false);

  protected async pickTckFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Файл завеликий (понад 2 МБ)');
      const data: unknown = JSON.parse(await file.text());
      const raw = Array.isArray(data) ? data : (data as TckImportFile).items;
      if (!Array.isArray(raw)) throw new Error('У файлі немає переліку ТЦК (items)');
      const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const items: TckImportItem[] = raw
        .map((r: Record<string, unknown>) => {
          const item: TckImportItem = { name: str(r?.['name']) };
          for (const k of ['nameGenitive', 'address', 'postalCode', 'phone', 'email'] as const) {
            const v = str(r?.[k]);
            if (v) item[k] = v;
          }
          return item;
        })
        .filter((i) => i.name);
      if (!items.length) throw new Error('У файлі немає жодного ТЦК');
      if (items.length > 2000) throw new Error('Не більше 2000 записів за раз');
      this.tckImport.set({ file: file.name, items });
    } catch (err) {
      this.toast.error(
        err instanceof SyntaxError ? 'Це не JSON-файл експорту ТЦК' : (err as Error).message,
      );
    }
  }

  protected async confirmTckImport() {
    const pending = this.tckImport();
    if (!pending) return;
    this.importingTck.set(true);
    try {
      const r = await this.organizationService.importTck(pending.items);
      this.tckImport.set(null);
      await this.dict.reloadTcks();
      this.toast.success(`Імпортовано: нових ${r.created}, оновлено ${r.updated}`);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.importingTck.set(false);
    }
  }

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
    pattern(p.postalCode, PATTERN.postalCode, { message: MESSAGE.postalCode });
    maxLength(p.phone, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.email, 200, { message: MESSAGE.tooLong(200) });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
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
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.tckForm, this.notifyError);
      }
    });
  }
}
