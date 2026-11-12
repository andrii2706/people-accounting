import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { form, FormField, max, min, pattern, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import {
  DB_MAX_PORT,
  DB_MESSAGE,
  DB_MIN_PORT,
  DB_PATTERN,
  DB_SSL_OPTIONS,
  DB_STATUS_LABELS,
  EMPTY_DATABASE_FORM,
} from '../../../shared/constants/entity-database.constants';
import type {
  DatabaseCheckResult,
  DbSslMode,
  EntityDatabaseForm,
  EntityDatabasePageData,
} from '../../../shared/interfaces/entity-database.interface';
import { EntityDatabaseService } from '../../../shared/services/entity-database.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

/**
 * The own database of a legal entity, stage 1: the connection is saved (the password — encrypted)
 * and checked. The data of the employees stays in the main database until stage 2.
 */
@Component({
  selector: 'app-entity-database',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    SelectComponent,
    RouterLink,
    UaDatePipe,
  ],
  templateUrl: './entity-database.component.html',
})
export class EntityDatabaseComponent {
  private readonly service = inject(EntityDatabaseService);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();
  private readonly notifyError = (message: string) => this.toast.error(message);

  /** entityDatabaseResolver */
  readonly data = input.required<EntityDatabasePageData>();

  protected readonly statusLabels = DB_STATUS_LABELS;
  protected readonly sslOptions = computed(() =>
    DB_SSL_OPTIONS.filter((o) => o.value !== 'disable' || this.data().db.allowPlainText),
  );

  protected readonly model = linkedSignal<EntityDatabaseForm>(() => {
    const db = this.data().db;
    if (!db.configured) return { ...EMPTY_DATABASE_FORM };
    return {
      host: db.host,
      port: db.port,
      database: db.database,
      username: db.username,
      password: '',
      sslMode: db.sslMode,
    };
  });

  protected readonly f = form(this.model, (p) => {
    required(p.host, { message: 'Вкажіть адресу сервера' });
    pattern(p.host, DB_PATTERN.host, { message: DB_MESSAGE.host });
    required(p.port, { message: 'Вкажіть порт' });
    min(p.port, DB_MIN_PORT, { message: `Порт — від ${DB_MIN_PORT}` });
    max(p.port, DB_MAX_PORT, { message: `Порт — до ${DB_MAX_PORT}` });
    required(p.database, { message: 'Вкажіть назву бази' });
    pattern(p.database, DB_PATTERN.database, { message: DB_MESSAGE.database });
    required(p.username, { message: 'Вкажіть користувача' });
    pattern(p.username, DB_PATTERN.username, { message: DB_MESSAGE.username });
    required(p.password, {
      message: 'Вкажіть пароль',
      when: () => !this.data().db.hasPassword,
    });
  });

  /** The result of the last «Перевірити» on this page (the saved one is in data().db). */
  protected readonly checkResult = signal<DatabaseCheckResult | null>(null);
  protected readonly checking = signal(false);
  protected readonly removing = signal(false);

  protected setSsl(value: string) {
    if (value) this.model.update((m) => ({ ...m, sslMode: value as DbSslMode }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.f, async () => {
      try {
        const m = this.model();
        await this.service.save(this.data().entityId, {
          ...m,
          host: m.host.trim(),
          port: Number(m.port),
        });
        this.toast.success('Параметри збережено — перевірте підключення');
        this.checkResult.set(null);
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.f, this.notifyError);
      }
    });
  }

  protected async check() {
    this.checking.set(true);
    try {
      const result = await this.service.check(this.data().entityId);
      this.checkResult.set(result);
      if (result.ok) this.toast.success('Підключення працює');
      else this.toast.error(result.message);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося перевірити підключення'));
    } finally {
      this.checking.set(false);
    }
  }

  protected async remove() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Видалити параметри підключення? Пароль буде стерто.')
    ) {
      return;
    }
    this.removing.set(true);
    try {
      await this.service.remove(this.data().entityId);
      this.toast.success('Підключення видалено');
      this.checkResult.set(null);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося видалити'));
    } finally {
      this.removing.set(false);
    }
  }
}
