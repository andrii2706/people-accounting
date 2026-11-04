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
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import { PersonAccessComponent } from '../person-access/person-access.component';
import { AuthService } from '../../../shared/services/auth.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import type {
  LegalEntityForm,
  LegalEntityPageData,
} from '../../../shared/interfaces/legal-entity.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import {
  applyRegistry,
  legalEntityBody,
  legalEntityToForm,
  youControlUrl,
} from '../../../shared/utils/legal-entity.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';

/**
 * A legal entity: requisites (can be pulled from the free ЄДР service), the head and the person
 * responsible for military registration — only the current details, they go into the documents.
 */
@Component({
  selector: 'app-legal-entity-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    PhoneInputComponent,
    PersonAccessComponent,
    RouterLink,
  ],
  templateUrl: './legal-entity-form.component.html',
})
export class LegalEntityFormComponent {
  private readonly service = inject(LegalEntitiesService);
  private readonly dict = inject(DictionariesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly organizationService = inject(OrganizationService);
  protected readonly auth = inject(AuthService);
  private readonly refresh = injectRouteRefresh();
  private readonly notifyError = (message: string) => this.toast.error(message);

  /** legalEntityPageResolver */
  readonly page = input.required<LegalEntityPageData>();
  protected readonly isNew = computed(() => !this.page().entity);

  protected readonly model = linkedSignal<LegalEntityForm>(() =>
    legalEntityToForm(this.page().entity),
  );
  protected readonly entityForm = form(this.model, (p) => {
    required(p.fullName, { message: 'Вкажіть повну назву' });
    required(p.edrpou, { message: 'Вкажіть код ЄДРПОУ' });
    pattern(p.edrpou, PATTERN.companyCode, { message: MESSAGE.companyCode });
    pattern(p.postalCode, PATTERN.postalCode, { message: MESSAGE.postalCode });
    pattern(p.phone, PATTERN.phoneE164, { message: MESSAGE.phoneE164 });
    pattern(p.responsiblePhone, PATTERN.phoneE164, { message: MESSAGE.phoneE164 });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    const len = (path: Parameters<typeof maxLength<string>>[0], max: number) =>
      maxLength(path, max, { message: MESSAGE.tooLong(max) });
    len(p.fullName, 500);
    len(p.nameLocative, 500);
    len(p.shortName, 300);
    len(p.address, 500);
    len(p.email, 200);
    len(p.letterNumberPrefix, 30);
    len(p.headPosition, 200);
    len(p.headName, 200);
    len(p.responsibleName, 200);
    len(p.responsiblePosition, 200);
    len(p.reservationQuotaBasis, 300);
    len(p.notifyEmails, 500);
    validate(p.reservationQuota, ({ value }) => {
      const v = value().trim();
      if (!v) return undefined;
      if (!/^\d+$/.test(v)) return { kind: 'quota', message: 'Ціле число без пробілів, напр. 25' };
      return Number(v) > 100_000 ? { kind: 'quota', message: 'Не більше 100 000' } : undefined;
    });
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

  protected readonly youControl = computed(() => youControlUrl(this.model().edrpou));
  protected readonly people = computed(() => this.page().people);
  protected readonly status = computed(() => this.page().status);

  protected readonly lookingUp = signal(false);
  /** What came from the registry last time: shown under the code. */
  protected readonly registryNote = signal('');

  protected async pullFromRegistry() {
    const field = this.entityForm.edrpou;
    field().markAsTouched();
    if (field().invalid()) return;
    this.lookingUp.set(true);
    try {
      const company = await this.service.lookup(this.model().edrpou.trim());
      this.model.update((m) => applyRegistry(m, company));
      this.registryNote.set(
        `Заповнено з ${company.source}${company.kved ? ` · КВЕД ${company.kved}` : ''}. Перевірте й збережіть.`,
      );
    } catch (err) {
      this.registryNote.set('');
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.lookingUp.set(false);
    }
  }

  /** After access was given / revoked / the person replaced — reload the entity. */
  protected reload() {
    return this.refresh();
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

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.entityForm, async () => {
      try {
        const body = legalEntityBody(this.model());
        const entity = this.page().entity;
        if (entity) await this.service.update(entity.id, body);
        else await this.service.create(body);
        await this.dict.reloadLegalEntities();
        this.toast.success(entity ? 'Юрособу збережено' : 'Юрособу додано');
        await this.router.navigateByUrl('/settings');
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.entityForm, this.notifyError);
      }
    });
  }
}
