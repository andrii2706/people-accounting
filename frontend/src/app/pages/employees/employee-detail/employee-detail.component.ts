import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { httpResource } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CategoryBadgeComponent } from '../../../shared/components/category-badge/category-badge.component';
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
import type {
  EmployeeNotice,
  ExternalNoticeForm,
} from '../../../shared/interfaces/letter.interface';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import {
  EMPTY_EXTERNAL_NOTICE,
  EXTERNAL_NOTICE_TYPES,
} from '../../../shared/constants/letter.constants';
import { todayIso } from '../../../shared/utils/date.utils';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import type { InfoRow, InfoSection } from '../../../shared/interfaces/ui.interface';
import type { NotificationStatus } from '../../../shared/interfaces/organization.interface';

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
    DateInputComponent,
    SelectComponent,
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

  protected readonly extractUrl = computed(() => {
    const e = this.e();
    return e?.derived.listGroup
      ? this.reportsService.listsDocxUrl({ ids: [e.id], entity: e.legalEntityId ?? '' })
      : null;
  });

  /** Mobilization term — for deferrals «до завершення мобілізації». */
  protected readonly mobilization = httpResource<NotificationStatus>(
    () => '/api/notifications/status',
  );

  protected readonly sections = computed<InfoSection[]>(() => {
    const e = this.e();
    if (!e) return [];
    const d = (v: string | null | undefined) => (v ? v.split('-').reverse().join('.') : '');
    const join = (...parts: (string | null | undefined | false)[]) =>
      parts.filter((p): p is string => !!p && !!p.trim()).join(', ');
    const officer = e.rankCode !== null && e.rankCode >= 12;
    const conscript = e.rankCode === 0;
    const mobilizationUntil = this.mobilization.value()?.mobilizationUntil;
    const documents = (e.militaryDocuments ?? [])
      .map((doc) =>
        join(
          doc.type,
          doc.series && `серія ${doc.series}`,
          doc.number && `№ ${doc.number}`,
          doc.issuedAt && `виданий ${d(doc.issuedAt)}`,
          doc.issuedBy,
          (doc.generatedDate || doc.generatedTime) &&
            `сформовано ${join(doc.generatedTime, d(doc.generatedDate)).replace(', ', ' ')}`,
        ),
      )
      .join('\n');
    const military: InfoRow[] = [
      { label: 'Перебуває на військовому обліку', value: e.militaryRegistered ? 'так' : 'ні' },
      { label: 'Військове звання', value: e.derived.rankTitle || (conscript ? 'призовник' : '') },
      { label: 'Склад', value: e.derived.compositionLabel },
      { label: 'ВОС', value: conscript ? 'не заповнюється' : e.vos },
      {
        label: officer ? 'Розряд' : 'Категорія обліку',
        value: conscript ? '' : e.accountingCategory,
      },
      ...(officer ? [{ label: 'Склад (профіль підготовки)', value: e.trainingProfile }] : []),
      { label: 'Проходив військову службу', value: e.servedInArmy ? 'так' : 'ні' },
      { label: 'Номер у реєстрі «Оберіг»', value: e.registryNumber },
      {
        label: 'ТЦК та СП',
        value: join(e.tck?.name, e.tckRegisteredAt && `з ${d(e.tckRegisteredAt)}`),
      },
      { label: 'Військово-облікові документи', value: documents },
      {
        label: 'Придатність',
        value: join(e.fitness, e.fitnessBasis),
      },
      {
        label: 'ВЛК',
        value: join(
          e.fitnessDate && `пройдено ${d(e.fitnessDate)}`,
          e.nextVlkDate && `наступна ${d(e.nextVlkDate)}`,
        ),
      },
      {
        label: 'Бронювання',
        value: !e.reserved
          ? 'ні'
          : e.reservedBy === 'OTHER'
            ? join(
                'заброньований іншою юридичною особою',
                e.reservedByName &&
                  `${e.reservedByName}${e.reservedByEdrpou ? ` (ЄДРПОУ ${e.reservedByEdrpou})` : ''}`,
                e.reservationUntil && `до ${d(e.reservationUntil)}`,
                e.specialAccountingCertificate && `посв. № ${e.specialAccountingCertificate}`,
              )
            : join(
                e.reservationUntil && `до ${d(e.reservationUntil)}`,
                e.specialAccountingCertificate && `посв. № ${e.specialAccountingCertificate}`,
                'за нашим підприємством',
              ),
      },
      { label: 'Відстрочка від строкової служби', value: e.deferralConscriptionBasis },
      {
        label: 'Відстрочка від мобілізації',
        value: join(
          e.deferralMobilizationBasis,
          e.deferralUntilMobilizationEnd
            ? `до завершення мобілізації${mobilizationUntil ? ` (зараз — ${d(mobilizationUntil)})` : ''}`
            : e.deferralUntil && `до ${d(e.deferralUntil)}`,
        ),
      },
      { label: 'Служба в резерві (№ команди)', value: e.reserveTeamNumber },
      {
        label: 'Мобілізаційне розпорядження',
        value: e.mobilizationOrderDate ? `від ${d(e.mobilizationOrderDate)}` : '',
      },
      {
        label: 'Мобілізація',
        value: join(
          e.mobilizedAt && `з ${d(e.mobilizedAt)}`,
          e.mobilizationReleaseOrder && `наказ про увільнення № ${e.mobilizationReleaseOrder}`,
          e.demobilizedAt && `демобілізований ${d(e.demobilizedAt)}`,
          e.readmissionOrder && `наказ про допуск № ${e.readmissionOrder}`,
        ),
      },
      { label: 'Відомості про військову службу', value: e.militaryServiceInfo },
    ];
    const personal: InfoRow[] = [
      { label: 'Стать', value: e.gender === 'F' ? 'жіноча' : 'чоловіча' },
      {
        label: 'Дата народження',
        value: join(d(e.birthDate), e.derived.age !== null ? `${e.derived.age} р.` : ''),
      },
      { label: 'РНОКПП', value: e.rnokpp },
      { label: 'Табельний №', value: e.personnelNumber },
      { label: 'Телефон', value: e.phone },
      { label: 'Email', value: e.email },
      { label: 'Зареєстроване місце проживання', value: e.registeredAddress },
      { label: 'Фактичне місце проживання', value: e.actualAddress },
      {
        label: 'Паспорт',
        value: join(
          e.passportNumber && (e.passportType === 'ID_CARD' ? 'ID-картка' : 'книжечка'),
          e.passportSeries,
          e.passportNumber && `№ ${e.passportNumber}`,
          e.passportIssuedAt && `виданий ${d(e.passportIssuedAt)}`,
          e.passportIssuedBy,
        ),
      },
      {
        label: 'Закордонний паспорт',
        value: join(
          e.foreignPassportSeries,
          e.foreignPassportNumber && `№ ${e.foreignPassportNumber}`,
          e.foreignPassportIssuedAt && `виданий ${d(e.foreignPassportIssuedAt)}`,
          e.foreignPassportValidUntil && `дійсний до ${d(e.foreignPassportValidUntil)}`,
          e.foreignPassportIssuedBy,
        ),
      },
      {
        label: (e.educations?.length ?? 0) > 1 ? 'Освіта (усі документи)' : 'Освіта',
        value: e.educations?.length
          ? e.educations
              .map((ed) =>
                join(
                  ed.level,
                  ed.institution,
                  ed.specialty && `спеціальність «${ed.specialty}»`,
                  ed.document,
                  ed.documentDate && `від ${d(ed.documentDate)}`,
                ),
              )
              .join('\n')
          : join(
              e.educationLevel,
              e.educationSpecialty,
              e.educationDocument,
              d(e.educationDocumentDate),
            ),
      },
      { label: 'Сімейний стан', value: this.dict.maritalLabel(e.maritalStatus, e.gender) },
    ];
    const positions = [...(e.positions ?? [])]
      .sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''))
      .map((p, i, all) =>
        join(
          `${p.position}${i === all.length - 1 ? ' (поточна)' : ''}`,
          p.department,
          p.since && `з ${d(p.since)}`,
          (p.orderNumber || p.orderDate) &&
            `${p.orderDocName || 'наказ'}${p.orderNumber ? ` № ${p.orderNumber}` : ''}${p.orderDate ? ` від ${d(p.orderDate)}` : ''}`,
        ),
      )
      .join('\n');
    const work: InfoRow[] = [
      {
        label: 'Прийнятий на роботу',
        value: join(
          d(e.hireDate),
          (e.hireOrderNumber || e.hireOrderDate) &&
            `${e.hireOrderDocName || 'наказ'}${e.hireOrderNumber ? ` № ${e.hireOrderNumber}` : ''}${e.hireOrderDate ? ` від ${d(e.hireOrderDate)}` : ''}`,
        ),
      },
      { label: 'Посади', value: positions || join(e.position, e.department) },
      {
        label: 'Звільнений',
        value: e.dismissalDate
          ? join(
              d(e.dismissalDate),
              (e.dismissalOrderNumber || e.dismissalOrderDate) &&
                `${e.dismissalOrderDocName || 'наказ'}${e.dismissalOrderNumber ? ` № ${e.dismissalOrderNumber}` : ''}${e.dismissalOrderDate ? ` від ${d(e.dismissalOrderDate)}` : ''}`,
            )
          : 'ні',
      },
    ];
    return [
      { title: 'Військово-облікові дані', rows: military },
      { title: 'Особиста інформація', rows: personal },
      { title: 'Робота', rows: work },
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

  /** Notice number by letter (for the history of changes): «12/3» when the letter holds several. */
  private readonly noticeNumbers = computed(
    () => new Map(this.notices().map((n) => [n.letter.id, n.number])),
  );
  protected noticeNumber(letterId: string) {
    return this.noticeNumbers().get(letterId) ?? '';
  }

  // notices sent before the system: number and date as on paper, no document
  protected readonly externalTypes = EXTERNAL_NOTICE_TYPES;
  protected readonly externalOpen = signal(false);
  protected readonly externalModel = signal<ExternalNoticeForm>({ ...EMPTY_EXTERNAL_NOTICE });
  protected readonly externalForm = form(this.externalModel, (p) => {
    required(p.number, { message: 'Вкажіть вихідний номер листа' });
    maxLength(p.number, 50, { message: 'Не більше 50 символів' });
    required(p.date, { message: 'Вкажіть дату листа' });
    validate(p.date, ({ value }) =>
      value() && value() > todayIso()
        ? { kind: 'future', message: 'Дата ще не настала' }
        : undefined,
    );
    maxLength(p.description, 1000, { message: 'Не більше 1000 символів' });
  });
  protected readonly tckOptions = computed(() =>
    this.dict.activeTcks().map((t) => ({ value: t.id, label: t.name })),
  );
  /** Pending changes this old notice already reported — they leave the queue. */
  protected readonly coveredChanges = signal<ReadonlySet<string>>(new Set());

  protected openExternal() {
    const e = this.e();
    this.externalModel.set({
      ...EMPTY_EXTERNAL_NOTICE,
      tckId: e?.tckId ?? '',
      effectiveDate: e?.hireDate ?? '',
    });
    this.externalForm().reset();
    this.coveredChanges.set(new Set());
    this.externalOpen.set(true);
  }

  protected setExternalType(type: string) {
    const e = this.e();
    const changeType = type as ExternalNoticeForm['changeType'];
    this.externalModel.update((m) => ({
      ...m,
      changeType,
      effectiveDate:
        changeType === 'HIRE'
          ? (e?.hireDate ?? m.effectiveDate)
          : changeType === 'DISMISSAL'
            ? (e?.dismissalDate ?? m.effectiveDate)
            : m.effectiveDate,
    }));
  }

  protected toggleCovered(id: string) {
    this.coveredChanges.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected async saveExternal(event: Event) {
    event.preventDefault();
    const e = this.e();
    if (!e) return;
    await submit(this.externalForm, async () => {
      try {
        const m = this.externalModel();
        const letter = await this.lettersService.createExternalNotice({
          employeeId: e.id,
          number: m.number.trim(),
          date: m.date,
          changeType: m.changeType,
          effectiveDate: m.effectiveDate || undefined,
          tckId: m.tckId || undefined,
          description: m.description.trim() || undefined,
          changeIds: [...this.coveredChanges()],
        });
        this.externalOpen.set(false);
        this.toast.success(`Внесено повідомлення вих. № ${letter.number}`);
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.externalForm, (message) => this.toast.error(message));
      }
    });
  }

  /** A notice entered by mistake: removed, its changes go back to the queue. */
  protected async removeExternal(n: EmployeeNotice) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Видалити внесене вручну повідомлення № ${n.number}?`)
    )
      return;
    try {
      await this.lettersService.remove(n.letter.id);
      this.toast.success('Повідомлення видалено');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}
