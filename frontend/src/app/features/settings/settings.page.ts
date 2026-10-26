import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { form, FormField, maxLength, min, pattern, required, submit, validate } from '@angular/forms/signals';
import { MESSAGE, PATTERN } from '../../core/validation/employee-rules';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { ApiService } from '../../core/api/api.service';
import type { Organization, ResponsiblePerson, Tck } from '../../core/api/api.types';
import { DictionariesStore } from '../../core/api/dictionaries.store';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/ui/toast.service';
import { FormFieldWrapper } from '../../shared/form-field';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { todayIso, UaDatePipe } from '../../shared/ua-date.pipe';

const EMPTY_ORG: Organization = {
  fullName: '', nameLocative: '', shortName: '', edrpou: '', address: '', phone: '', email: '',
  headPosition: 'Директор', headName: '', letterNumberPrefix: '', alertDays: 30, notifyDeadlineDays: 7,
};

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, FormField, FormFieldWrapper, Icon, UaDatePipe, RouterLink],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly dict = inject(DictionariesStore);

  // ---------- реквізити підприємства
  private readonly orgResource = httpResource<Organization>(() => '/api/organization');
  protected readonly orgModel = linkedSignal<Organization>(() => ({ ...EMPTY_ORG, ...(this.orgResource.value() ?? {}) }));
  protected readonly orgForm = form(this.orgModel, (p) => {
    required(p.fullName, { message: 'Вкажіть повну назву' });
    required(p.nameLocative, { message: 'Потрібно для заголовків списків' });
    required(p.shortName, { message: 'Вкажіть скорочену назву' });
    const len = (path: Parameters<typeof maxLength<string>>[0], max: number) => maxLength(path, max, { message: MESSAGE.tooLong(max) });
    len(p.fullName, 500); len(p.nameLocative, 500); len(p.shortName, 300); len(p.edrpou, 10); len(p.address, 500);
    len(p.phone, 100); len(p.email, 200); len(p.headPosition, 200); len(p.headName, 200); len(p.letterNumberPrefix, 30);
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    min(p.alertDays, 1, { message: 'Щонайменше 1 день' });
    min(p.notifyDeadlineDays, 1, { message: 'Щонайменше 1 день' });
    validate(p.edrpou, ({ value }) => (value() && !/^\d{8,10}$/.test(value()) ? { kind: 'edrpou', message: '8 цифр (ЄДРПОУ) або 10 (РНОКПП ФОП)' } : undefined));
  });

  protected async saveOrg(event: Event) {
    event.preventDefault();
    await submit(this.orgForm, async () => {
      try {
        const m = this.orgModel();
        await this.api.updateOrganization({ ...m, alertDays: Number(m.alertDays), notifyDeadlineDays: Number(m.notifyDeadlineDays) });
        this.toast.success('Реквізити збережено');
        this.orgResource.reload();
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  // ---------- відповідальні особи
  protected readonly persons = httpResource<ResponsiblePerson[]>(() => '/api/organization/responsible-persons', { defaultValue: [] });
  protected readonly personModel = signal({ fullName: '', position: '', phone: '', orderNumber: '', validFrom: todayIso(), validTo: '' });
  protected readonly personForm = form(this.personModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я та прізвище' });
    required(p.validFrom, { message: 'Вкажіть дату початку' });
    maxLength(p.fullName, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.position, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.phone, 100, { message: MESSAGE.tooLong(100) });
    maxLength(p.orderNumber, 50, { message: MESSAGE.tooLong(50) });
    validate(p.validTo, ({ value, valueOf }) => (value() && value() < valueOf(p.validFrom) ? { kind: 'order', message: 'Раніше за дату початку' } : undefined));
  });

  protected async addPerson(event: Event) {
    event.preventDefault();
    await submit(this.personForm, async () => {
      try {
        const m = this.personModel();
        await this.api.createResponsible({ ...m, validTo: m.validTo || null });
        this.personModel.set({ fullName: '', position: '', phone: '', orderNumber: '', validFrom: todayIso(), validTo: '' });
        this.personForm().reset();
        this.persons.reload();
        this.toast.success('Додано');
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  protected async removePerson(id: string) {
    try {
      await this.api.deleteResponsible(id);
      this.persons.reload();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  // ---------- довідник ТЦК
  protected readonly tckFilter = signal('');
  protected readonly tcks = computed(() => {
    const q = this.tckFilter().toLowerCase();
    return this.dict.tcks().filter((t) => !q || t.name.toLowerCase().includes(q));
  });
  protected readonly editingTck = signal<string | null>(null);
  protected readonly tckModel = signal<Pick<Tck, 'name' | 'nameGenitive' | 'address' | 'phone' | 'email'>>({ name: '', nameGenitive: '', address: '', phone: '', email: '' });
  protected readonly tckForm = form(this.tckModel, (p) => {
    required(p.name, { message: 'Вкажіть назву' });
    maxLength(p.name, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.nameGenitive, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.address, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.phone, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.email, 200, { message: MESSAGE.tooLong(200) });
    validate(p.email, ({ value }) => (value() && !/^\S+@\S+\.\S+$/.test(value()) ? { kind: 'email', message: 'Некоректний email' } : undefined));
  });

  protected editTck(t: Tck | null) {
    this.editingTck.set(t?.id ?? 'new');
    this.tckModel.set(t ? { name: t.name, nameGenitive: t.nameGenitive, address: t.address, phone: t.phone, email: t.email } : { name: '', nameGenitive: '', address: '', phone: '', email: '' });
    this.tckForm().reset();
  }

  protected async saveTck(event: Event) {
    event.preventDefault();
    await submit(this.tckForm, async () => {
      try {
        const id = this.editingTck();
        await this.api.saveTck(this.tckModel(), id && id !== 'new' ? id : undefined);
        this.editingTck.set(null);
        this.dict.reloadTcks();
        this.toast.success('ТЦК збережено');
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }
}
