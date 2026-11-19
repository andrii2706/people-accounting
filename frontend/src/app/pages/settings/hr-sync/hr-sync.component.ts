import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import {
  disabled,
  form,
  FormField,
  pattern,
  readonly,
  required,
  submit,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import {
  EMPTY_HR_FORM,
  HR_1C_PROCESSOR_URLS,
  HR_ACTION_ORDER,
  HR_ACTION_TEXT,
  HR_HOUR_OPTIONS,
  HR_MODE_TEXT,
  HR_POLICY_OPTIONS,
  HR_SOURCE_LABELS,
  HR_STATUS_TEXT,
  HR_SYSTEM_OPTIONS,
} from '../../../shared/constants/hr-sync.constants';
import type {
  HrBatchItem,
  HrBatchView,
  HrItemAction,
  HrMilitaryPolicy,
  HrODataCheck,
  HrSyncForm,
  HrSyncMode,
  HrSyncPageData,
  HrSystem,
} from '../../../shared/interfaces/hr-sync.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { HrSyncService } from '../../../shared/services/hr-sync.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { hrBatchTime, hrCountsText } from '../../../shared/utils/hr-sync.utils';

/**
 * «Налаштування → Юрособа → Інтеграція з 1С»: where the employees come from (1C sends them with a key, or we
 * read the published base), what is done with them, and the deliveries — with a review before applying.
 */
@Component({
  selector: 'app-hr-sync',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PasswordInputComponent,
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    SelectComponent,
    RouterLink,
    UaDatePipe,
  ],
  templateUrl: './hr-sync.component.html',
})
export class HrSyncComponent {
  private readonly service = inject(HrSyncService);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();
  private readonly notifyError = (message: string) => this.toast.error(message);
  protected readonly auth = inject(AuthService);

  /** hrSyncResolver */
  readonly data = input.required<HrSyncPageData>();

  protected readonly systemOptions = HR_SYSTEM_OPTIONS;
  protected readonly policyOptions = HR_POLICY_OPTIONS;
  protected readonly hourOptions = HR_HOUR_OPTIONS;
  protected readonly modeText = HR_MODE_TEXT;
  protected readonly modes: HrSyncMode[] = ['PUSH', 'ODATA', 'FILE'];
  protected readonly statusText = HR_STATUS_TEXT;
  protected readonly sourceLabels = HR_SOURCE_LABELS;
  protected readonly actionText = HR_ACTION_TEXT;
  protected readonly processorUrls = HR_1C_PROCESSOR_URLS;
  protected readonly countsText = hrCountsText;
  protected readonly time = hrBatchTime;

  /** Only the managers of the legal entity change the connection; HR sees it and works with the deliveries. */
  protected readonly canConfigure = this.auth.isEntityManager;

  protected readonly model = linkedSignal<HrSyncForm>(() => {
    const s = this.data().settings;
    if (!s.configured) return { ...EMPTY_HR_FORM };
    return {
      system: s.system,
      mode: s.mode,
      odataUrl: s.odataUrl,
      odataUser: s.odataUser,
      odataPassword: '',
      organizationCode: s.organizationCode,
      scheduleEnabled: s.scheduleEnabled,
      scheduleHour: s.scheduleHour,
      autoApply: s.autoApply,
      militaryPolicy: s.militaryPolicy,
      importDismissed: s.importDismissed,
    };
  });

  protected readonly f = form(this.model, (p) => {
    const odata = () => this.model().mode === 'ODATA';
    required(p.odataUrl, { message: 'Вкажіть адресу публікації 1С', when: odata });
    pattern(p.odataUrl, /^https?:\/\/[^\s/]+(\/\S*)?$/i, {
      message: 'Адреса — https://сервер/база',
    });
    required(p.odataUser, { message: 'Вкажіть користувача 1С', when: odata });
    required(p.odataPassword, {
      message: 'Вкажіть пароль',
      when: () => odata() && !this.data().settings.hasOdataPassword,
    });
    pattern(p.organizationCode, /^(\d{8}|\d{10})?$/, {
      message: 'Код ЄДРПОУ — 8 цифр (або 10 для ФОП)',
    });
    // HR sees the connection but does not change it
    const locked = () => !this.canConfigure();
    for (const field of [p.odataUrl, p.odataUser, p.odataPassword, p.organizationCode])
      readonly(field, locked);
    for (const field of [p.scheduleEnabled, p.autoApply, p.importDismissed])
      disabled(field, locked);
  });

  /** The key just issued — shown once on this page and never again. */
  protected readonly issuedToken = signal('');
  /** Where 1C sends the data: the address of this application + the path of the API. */
  protected readonly pushUrl = signal('');
  protected readonly checkResult = signal<HrODataCheck | null>(null);
  protected readonly busy = signal<
    '' | 'check' | 'pull' | 'token' | 'revoke' | 'remove' | 'apply' | 'discard'
  >('');
  protected readonly confirmRevoke = signal(false);
  protected readonly confirmRemove = signal(false);

  protected readonly batch = signal<HrBatchView | null>(null);
  protected readonly actionFilter = signal<HrItemAction | ''>('');
  protected readonly batchItems = computed(() => {
    const b = this.batch();
    if (!b) return [];
    const filter = this.actionFilter();
    const rank = (i: HrBatchItem) => HR_ACTION_ORDER.indexOf(i.action);
    return b.items.filter((i) => !filter || i.action === filter).sort((a, c) => rank(a) - rank(c));
  });
  protected readonly batchActions = computed(() => {
    const b = this.batch();
    if (!b) return [];
    return HR_ACTION_ORDER.map((action) => ({
      action,
      count: b.items.filter((i) => i.action === action).length,
    })).filter((a) => a.count > 0);
  });

  constructor() {
    afterNextRender(() => {
      this.pushUrl.set(new URL(this.data().settings.pushUrl, document.baseURI).href);
    });
  }

  protected setMode(mode: HrSyncMode) {
    if (this.canConfigure()) this.model.update((m) => ({ ...m, mode }));
  }
  protected setSystem(value: string) {
    if (value) this.model.update((m) => ({ ...m, system: value as HrSystem }));
  }
  protected setPolicy(value: string) {
    if (value) this.model.update((m) => ({ ...m, militaryPolicy: value as HrMilitaryPolicy }));
  }
  protected setHour(value: string) {
    if (value) this.model.update((m) => ({ ...m, scheduleHour: Number(value) }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.f, async () => {
      try {
        const m = this.model();
        await this.service.save(this.data().entityId, {
          ...m,
          odataUrl: m.odataUrl.trim(),
          odataUser: m.odataUser.trim(),
          organizationCode: m.organizationCode.trim(),
        });
        this.toast.success(
          m.mode === 'PUSH' && !this.data().settings.tokenPrefix
            ? 'Збережено — тепер видайте ключ для 1С'
            : m.mode === 'ODATA'
              ? 'Збережено — перевірте з’єднання'
              : 'Збережено',
        );
        this.checkResult.set(null);
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.f, this.notifyError);
      }
    });
  }

  protected async issueToken() {
    this.busy.set('token');
    try {
      const { token } = await this.service.issueToken(this.data().entityId);
      this.issuedToken.set(token);
      this.toast.success('Ключ видано — скопіюйте його в обробку 1С');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося видати ключ'));
    } finally {
      this.busy.set('');
    }
  }

  protected async revokeToken() {
    if (!this.confirmRevoke()) {
      this.confirmRevoke.set(true);
      return;
    }
    this.busy.set('revoke');
    try {
      await this.service.revokeToken(this.data().entityId);
      this.issuedToken.set('');
      this.confirmRevoke.set(false);
      this.toast.success('Ключ відкликано — 1С більше не зможе надсилати дані');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося відкликати ключ'));
    } finally {
      this.busy.set('');
    }
  }

  protected async copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(`${what} скопійовано`);
    } catch {
      this.toast.error('Не вдалося скопіювати — виділіть і скопіюйте вручну');
    }
  }

  protected async check() {
    this.busy.set('check');
    try {
      const result = await this.service.check(this.data().entityId);
      this.checkResult.set(result);
      if (result.ok) this.toast.success(result.message);
      else this.toast.error(result.message);
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося перевірити з’єднання'));
    } finally {
      this.busy.set('');
    }
  }

  protected async pull() {
    this.busy.set('pull');
    try {
      const batch = await this.service.pull(this.data().entityId);
      this.toast.success(batch.message || 'Дані з 1С отримано');
      this.batch.set(batch);
      this.actionFilter.set('');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося отримати дані з 1С'));
    } finally {
      this.busy.set('');
    }
  }

  protected async open(batchId: string) {
    if (this.batch()?.id === batchId) {
      this.batch.set(null);
      return;
    }
    try {
      this.batch.set(await this.service.batch(this.data().entityId, batchId));
      this.actionFilter.set('');
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося відкрити отримання'));
    }
  }

  protected async apply() {
    const b = this.batch();
    if (!b) return;
    this.busy.set('apply');
    try {
      const result = await this.service.apply(this.data().entityId, b.id);
      this.batch.set(result);
      if (result.status === 'APPLIED') this.toast.success(result.message);
      else this.toast.error(result.message);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося застосувати'));
    } finally {
      this.busy.set('');
    }
  }

  protected async discard() {
    const b = this.batch();
    if (!b) return;
    this.busy.set('discard');
    try {
      this.batch.set(await this.service.discard(this.data().entityId, b.id));
      this.toast.success('Отримання відхилено — картки не змінено');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося відхилити'));
    } finally {
      this.busy.set('');
    }
  }

  protected async remove() {
    if (!this.confirmRemove()) {
      this.confirmRemove.set(true);
      return;
    }
    this.busy.set('remove');
    try {
      await this.service.remove(this.data().entityId);
      this.issuedToken.set('');
      this.batch.set(null);
      this.confirmRemove.set(false);
      this.toast.success('Інтеграцію вимкнено, ключ і історію видалено');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося вимкнути'));
    } finally {
      this.busy.set('');
    }
  }
}
