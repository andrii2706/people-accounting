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
import type {
  NotificationStatus,
  Organization,
} from '../../../shared/interfaces/organization.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import {
  OrganizationService,
  type TckImportItem,
} from '../../../shared/services/organization.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

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

interface ExtraModel {
  reservationQuota: string;
  reservationQuotaBasis: string;
  mobilizationUntil: string;
  mobilizationDecree: string;
  notifyEmails: string;
}

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
        // The head is managed in «Керівник підприємства» (with history), not here.
        const { headName: _n, headPosition: _p, ...m } = this.orgModel();
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

  // ---------- head (director) history
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
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
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

  // ---------- reservation quota, mobilization, e-mail
  protected readonly extraModel = linkedSignal<ExtraModel>(() => {
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
    validate(p.reservationQuota, ({ value }) =>
      value() && !/^\d{1,6}$/.test(value().trim())
        ? { kind: 'quota', message: 'Ціле число, не менше 0' }
        : undefined,
    );
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
        : { kind: 'emails', message: 'Перелік email через кому' },
    );
  });
  protected readonly savingExtra = signal(false);

  private async saveExtra(fields: (keyof ExtraModel)[], ok: string) {
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

  // ---------- TCK import (file from `npm run tck:export`)
  protected readonly tckImport = signal<{ file: string; items: TckImportItem[] } | null>(null);
  protected readonly importingTck = signal(false);

  protected async pickTckFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Файл завеликий (понад 2 МБ)');
      const data: unknown = JSON.parse(await file.text());
      const raw = Array.isArray(data) ? data : (data as { items?: unknown }).items;
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
