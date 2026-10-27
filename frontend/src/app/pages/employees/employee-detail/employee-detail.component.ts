import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CategoryBadgeComponent } from '../../../shared/components/category-badge/category-badge.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { GroupBadgeComponent } from '../../../shared/components/group-badge/group-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LetterStatusBadgeComponent } from '../../../shared/components/letter-status-badge/letter-status-badge.component';
import { WarningsListComponent } from '../../../shared/components/warnings-list/warnings-list.component';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../shared/services/employees.service';
import { LettersService } from '../../../shared/services/letters.service';
import type { EmployeeNotice } from '../../../shared/interfaces/letter.interface';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

interface InfoRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-employee-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    CategoryBadgeComponent,
    GroupBadgeComponent,
    LetterStatusBadgeComponent,
    WarningsListComponent,
    UaDatePipe,
    UaDateTimePipe,
    FormField,
    FormFieldComponent,
  ],
  templateUrl: './employee-detail.component.html',
})
export class EmployeeDetailComponent {
  private readonly employeesService = inject(EmployeesService);
  protected readonly lettersService = inject(LettersService);
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly dict = inject(DictionariesService);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  /** Card from employeeDetailsResolver; after changes the resolver is re-run (refresh). */
  readonly employee = input.required<EmployeeDetails>();
  /** Stored notices sent to the TCK (employeeNoticesResolver). */
  readonly notices = input.required<EmployeeNotice[]>();
  protected readonly e = computed(() => this.employee());
  private readonly refresh = injectRouteRefresh();

  protected readonly showAudit = signal(false);
  protected readonly audit = this.employeesService.auditResource(() =>
    this.showAudit() ? this.id() : undefined,
  );

  protected readonly pendingChanges = computed(() =>
    (this.e()?.changes ?? []).filter((c) => !c.letter && !c.skipped),
  );
  protected readonly busy = signal(false);

  // ---- dismissal (Signal Form)
  protected readonly showDismiss = signal(false);
  protected readonly dismissModel = signal({
    dismissalDate: todayIso(),
    dismissalOrderNumber: '',
    dismissalOrderDate: '',
  });
  protected readonly dismissForm = form(this.dismissModel, (p) => {
    required(p.dismissalDate, { message: 'Вкажіть дату звільнення' });
    validate(p.dismissalDate, ({ value }) => {
      const hire = this.e()?.hireDate;
      return hire && value() && value() < hire
        ? { kind: 'beforeHire', message: 'Раніше за дату прийняття' }
        : undefined;
    });
  });

  protected readonly extractUrl = computed(() => {
    const e = this.e();
    return e?.derived.listGroup ? this.reportsService.listsDocxUrl(undefined, [e.id]) : null;
  });

  protected readonly sections = computed<{ title: string; rows: InfoRow[] }[]>(() => {
    const e = this.e();
    if (!e) return [];
    const d = (v: string | null) => (v ? v.split('-').reverse().join('.') : '');
    const join = (...parts: (string | null | undefined)[]) =>
      parts.filter((p) => p && p.trim()).join(', ');
    const military: InfoRow[] = [
      { label: 'Звання', value: e.derived.rankTitle || (e.rankCode === 0 ? 'призовник' : '') },
      { label: 'Склад', value: e.derived.compositionLabel },
      { label: 'ВОС', value: e.vos },
      {
        label: e.rankCode !== null && e.rankCode >= 12 ? 'Розряд' : 'Категорія обліку',
        value: e.accountingCategory,
      },
      { label: 'Профіль підготовки', value: e.trainingProfile },
      { label: 'Реєстр. номер ЄДР', value: e.registryNumber },
      { label: 'ТЦК та СП', value: e.tck?.name ?? '' },
      {
        label: 'Військовий документ',
        value: join(
          e.militaryDocType,
          e.militaryDocSeries && `серія ${e.militaryDocSeries}`,
          e.militaryDocNumber && `№ ${e.militaryDocNumber}`,
          d(e.militaryDocIssuedAt),
          e.militaryDocGeneratedAt && `сформовано ${e.militaryDocGeneratedAt}`,
        ),
      },
      { label: 'Придатність', value: join(e.fitness, e.fitnessBasis) },
      {
        label: 'Бронювання',
        value: join(
          e.reservationBasis,
          e.specialAccountingCertificate && `посв. № ${e.specialAccountingCertificate}`,
          e.reservationUntil && `до ${d(e.reservationUntil)}`,
        ),
      },
      {
        label: 'Відстрочка',
        value: join(
          e.deferralMobilizationBasis || e.deferralConscriptionBasis,
          e.deferralUntil && `до ${d(e.deferralUntil)}`,
        ),
      },
      { label: 'Резерв (№ команди)', value: e.reserveTeamNumber },
      {
        label: 'Мобілізація',
        value: join(
          e.mobilizedAt && `з ${d(e.mobilizedAt)}`,
          e.demobilizedAt && `демобілізований ${d(e.demobilizedAt)}`,
        ),
      },
    ];
    const personal: InfoRow[] = [
      {
        label: 'Дата народження',
        value: join(d(e.birthDate), e.derived.age !== null ? `${e.derived.age} р.` : ''),
      },
      { label: 'РНОКПП', value: e.rnokpp },
      { label: 'Табельний №', value: e.personnelNumber },
      { label: 'Телефон', value: e.phone },
      { label: 'Email', value: e.email },
      { label: 'Зареєстроване місце', value: e.registeredAddress },
      { label: 'Фактичне місце', value: e.actualAddress },
      {
        label: 'Паспорт',
        value: join(
          e.passportType === 'ID_CARD' ? 'ID-картка' : 'книжечка',
          e.passportSeries,
          e.passportNumber && `№ ${e.passportNumber}`,
          d(e.passportIssuedAt),
          e.passportIssuedBy,
        ),
      },
      {
        label: 'Закордонний паспорт',
        value: join(
          e.foreignPassportSeries,
          e.foreignPassportNumber && `№ ${e.foreignPassportNumber}`,
          e.foreignPassportValidUntil && `до ${d(e.foreignPassportValidUntil)}`,
        ),
      },
      { label: 'Освіта', value: join(e.educationLevel, e.educationSpecialty, e.educationDocument) },
    ];
    const work: InfoRow[] = [
      { label: 'Посада', value: join(e.position, e.department) },
      {
        label: 'Прийнятий',
        value: join(
          d(e.hireDate),
          e.hireOrderNumber && `наказ № ${e.hireOrderNumber}`,
          d(e.hireOrderDate),
        ),
      },
      {
        label: 'Призначення на посаду',
        value: join(e.positionOrder, e.positionSince && `з ${d(e.positionSince)}`),
      },
      {
        label: 'Звільнений',
        value: join(
          d(e.dismissalDate),
          e.dismissalOrderNumber && `наказ № ${e.dismissalOrderNumber}`,
        ),
      },
      { label: 'Сімейний стан', value: this.dict.maritalLabel(e.maritalStatus, e.gender) },
    ];
    return [
      { title: 'Військовий облік', rows: military },
      { title: 'Особисті дані', rows: personal },
      { title: 'Робота і сім’я', rows: work },
    ];
  });

  protected relationLabel(value: string) {
    return this.dict.dictionaries()?.familyRelations.find((r) => r.value === value)?.label ?? value;
  }

  protected async createNotice() {
    const e = this.e();
    if (!e) return;
    if (!e.tckId) {
      this.toast.error(
        'Вкажіть ТЦК працівника — без нього не зрозуміло, куди надсилати повідомлення.',
      );
      return;
    }
    this.busy.set(true);
    try {
      const letter = await this.lettersService.createChangeNotice(e.id);
      this.toast.success(`Сформовано лист вих. № ${letter.number}`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async skipChange(changeId: string) {
    try {
      await this.employeesService.updateChange(changeId, { skipped: true });
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  protected async dismiss(event: Event) {
    event.preventDefault();
    await submit(this.dismissForm, async () => {
      try {
        const m = this.dismissModel();
        await this.employeesService.dismiss(this.id(), {
          dismissalDate: m.dismissalDate,
          dismissalOrderNumber: m.dismissalOrderNumber,
          dismissalOrderDate: m.dismissalOrderDate || null,
        });
        this.showDismiss.set(false);
        this.toast.success('Звільнення зафіксовано. Додано повідомлення для ТЦК.');
        await this.refresh();
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  protected async remove() {
    const e = this.e();
    if (!e || typeof window === 'undefined') return;
    if (
      !window.confirm(
        `Видалити картку «${e.derived.fullName}» назавжди? Це не те саме, що звільнення.`,
      )
    )
      return;
    try {
      await this.employeesService.remove(e.id);
      this.toast.success('Картку видалено');
      await this.router.navigate(['/employees']);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  protected diffEntries(diff: Record<string, [unknown, unknown]>) {
    return Object.entries(diff).map(([field, [from, to]]) => ({
      field,
      from: this.show(from),
      to: this.show(to),
    }));
  }

  private show(v: unknown) {
    if (v === null || v === undefined || v === '') return '∅';
    return String(v);
  }
}
