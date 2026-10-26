import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  applyEach,
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  type SchemaPath,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import {
  apiPathToFormPath,
  type EmployeeFormModel,
  employeeToForm,
  emptyEmployeeForm,
  FIELD_META,
  type FormTab,
  formToPayload,
  reportableChanges,
} from './employee-form.model';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { FamilyRelation } from '../../../shared/interfaces/dictionary.interface';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../shared/services/employees.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import {
  AFTER_BIRTH_DATES,
  MAX_LENGTH,
  MESSAGE,
  NOT_FUTURE_DATES,
  PATTERN,
  rnokppMismatch,
} from '../../../shared/validators/employee-rules';

const TABS: { id: FormTab; label: string }[] = [
  { id: 'personal', label: 'Особисті дані' },
  { id: 'work', label: 'Робота' },
  { id: 'military', label: 'Військовий облік' },
  { id: 'documents', label: 'Паспорти й освіта' },
  { id: 'family', label: 'Сім’я' },
  { id: 'notes', label: 'Примітки' },
];

const DATE_FIELDS = [
  'birthDate',
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'foreignPassportValidUntil',
  'educationDocumentDate',
  'positionSince',
  'hireDate',
  'hireOrderDate',
  'militaryDocIssuedAt',
  'tckRegisteredAt',
  'fitnessDate',
  'reservationUntil',
  'deferralUntil',
  'mobilizationOrderDate',
  'mobilizedAt',
  'demobilizedAt',
  'changeEffectiveDate',
] as const;

/** Захист від «0002-05-12» з ручного введення року в date-інпуті. */
const sensibleDate = (v: string) =>
  !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= '2100-12-31');

const SPOUSES: FamilyRelation[] = ['WIFE', 'HUSBAND'];

/** Мінімальний інтерфейс стану поля, потрібний для навігації до помилок. */
interface FieldStateLike {
  invalid: () => boolean;
  touched: () => boolean;
  errors: () => readonly { message?: string }[];
  focusBoundControl: (options?: FocusOptions) => void;
}
type FieldLike = () => FieldStateLike;

export interface FormErrorItem {
  key: string;
  label: string;
  message: string;
  tab: FormTab | 'sidebar';
  index?: number;
}

@Component({
  selector: 'app-employee-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormFieldComponent, PageHeaderComponent, RouterLink, IconComponent],
  templateUrl: './employee-form.component.html',
})
export class EmployeeFormComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  protected readonly dict = inject(DictionariesService);

  /** :id з маршруту; для /employees/new — undefined. */
  readonly id = input<string>();

  protected readonly tabs = TABS;
  protected readonly tab = signal<FormTab>('personal');
  protected readonly saveError = signal('');
  /** Помилки з сервера, які не вдалося прив’язати до конкретного поля. */
  protected readonly serverErrors = signal<string[]>([]);
  protected readonly submitAttempted = signal(false);
  private readonly today = todayIso();

  /** Для редагування — дані з employeeDetailsResolver; для нового працівника — відсутні. */
  readonly employee = input<EmployeeDetails>();
  protected readonly isEdit = computed(() => !!this.id());

  /** Вихідний стан (для порівняння змін) і редагована модель — обидва похідні від завантаженого працівника. */
  private readonly original = computed(() => {
    const e = this.employee();
    return e ? employeeToForm(e, this.today) : null;
  });
  protected readonly model = linkedSignal<EmployeeFormModel>(
    () => this.original() ?? emptyEmployeeForm(this.today),
  );

  protected readonly changedLabels = computed(() =>
    reportableChanges(this.original(), this.model()),
  );

  // ---- похідні значення
  protected readonly rank = computed(() => {
    const code = this.model().rankCode;
    return code === '' ? undefined : this.dict.rank(Number(code));
  });
  protected readonly isOfficer = computed(() => (this.rank()?.code ?? -1) >= 12);
  protected readonly isConscript = computed(() => this.rank()?.code === 0);
  protected readonly isReservist = computed(() => !!this.model().reserveTeamNumber.trim());
  protected readonly isIdCard = computed(() => this.model().passportType === 'ID_CARD');
  /** Попередній розрахунок категорії та групи — та сама логіка, що й на сервері. */
  protected readonly preview = computed(() => {
    const m = this.model();
    if (!m.militaryRegistered) return { category: 'Не перебуває на обліку', group: '—' };
    if (m.gender === 'M' && m.rankCode === '')
      return { category: 'Оберіть звання або «призовник»', group: '—' };
    const reservist = this.isReservist();
    const category = reservist
      ? 'Резервіст'
      : this.isConscript()
        ? 'Призовник'
        : 'Військовозобов’язаний';
    let group: string;
    if (m.gender === 'F') group = reservist ? 'G3R' : 'G3';
    else if (this.isConscript()) group = reservist ? 'G4R' : 'G4';
    else if (this.isOfficer()) group = reservist ? 'G1R' : 'G1';
    else group = reservist ? 'G2R' : 'G2';
    return { category, group: `${group} — ${this.dict.groupTitle(group as never)}` };
  });

  protected readonly rnokppHint = computed(() => {
    const m = this.model();
    return rnokppMismatch(m.rnokpp, m.birthDate, m.gender);
  });

  // ================================================================ схема валідації
  protected readonly f = form(this.model, (p) => {
    const at = (key: string) => (p as unknown as Record<string, SchemaPath<string>>)[key];
    const isOfficer = (rank: string) => rank !== '' && Number(rank) >= 12;
    const isRankWithVos = (rank: string) => rank !== '' && rank !== '0';

    // довжини — ті самі, що й колонки в БД (інпут не дасть ввести більше)
    for (const [key, max] of Object.entries(MAX_LENGTH)) {
      maxLength(at(key), max, { message: MESSAGE.tooLong(max) });
    }

    // --- особисті дані
    required(p.lastName, { message: 'Вкажіть прізвище' });
    required(p.firstName, { message: 'Вкажіть ім’я' });
    pattern(p.lastName, PATTERN.name, { message: MESSAGE.name });
    pattern(p.firstName, PATTERN.name, { message: MESSAGE.name });
    pattern(p.middleName, PATTERN.name, { message: MESSAGE.name });
    pattern(p.rnokpp, PATTERN.rnokpp, { message: MESSAGE.rnokpp });
    pattern(p.phone, PATTERN.phone, { message: MESSAGE.phone });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });

    // --- паспорт: правила залежать від типу документа
    disabled(p.passportSeries, ({ valueOf }) =>
      valueOf(p.passportType) === 'ID_CARD' ? 'У ID-картки серії немає' : false,
    );
    pattern(p.passportSeries, PATTERN.passportBookSeries, {
      message: MESSAGE.passportBookSeries,
      when: ({ valueOf }) => valueOf(p.passportType) === 'BOOK',
    });
    required(p.passportSeries, {
      message: MESSAGE.passportBookSeries,
      when: ({ valueOf }) => valueOf(p.passportType) === 'BOOK' && !!valueOf(p.passportNumber),
    });
    pattern(p.passportNumber, PATTERN.idCardNumber, {
      message: MESSAGE.idCardNumber,
      when: ({ valueOf }) => valueOf(p.passportType) === 'ID_CARD',
    });
    pattern(p.passportNumber, PATTERN.passportBookNumber, {
      message: MESSAGE.passportBookNumber,
      when: ({ valueOf }) => valueOf(p.passportType) === 'BOOK',
    });
    pattern(p.passportIssuedBy, PATTERN.idCardIssuer, {
      message: MESSAGE.idCardIssuer,
      when: ({ valueOf }) => valueOf(p.passportType) === 'ID_CARD',
    });

    // --- закордонний паспорт
    pattern(p.foreignPassportSeries, PATTERN.foreignSeries, { message: MESSAGE.foreignSeries });
    pattern(p.foreignPassportNumber, PATTERN.foreignNumber, { message: MESSAGE.foreignNumber });
    required(p.foreignPassportSeries, {
      message: 'Вкажіть серію',
      when: ({ valueOf }) => !!valueOf(p.foreignPassportNumber),
    });
    required(p.foreignPassportNumber, {
      message: 'Вкажіть номер',
      when: ({ valueOf }) => !!valueOf(p.foreignPassportSeries),
    });
    validate(p.foreignPassportValidUntil, ({ value, valueOf }) => {
      const issued = valueOf(p.foreignPassportIssuedAt);
      return value() && issued && value() <= issued
        ? { kind: 'order', message: 'Має бути пізніше дати видачі' }
        : undefined;
    });

    // --- робота
    validate(p.positionSince, ({ value, valueOf }) => {
      const hire = valueOf(p.hireDate);
      return value() && hire && value() < hire
        ? { kind: 'order', message: 'Раніше за дату прийняття' }
        : undefined;
    });

    // --- військовий облік
    pattern(p.vos, PATTERN.vosOfficer, {
      message: MESSAGE.vosOfficer,
      when: ({ valueOf }) => isOfficer(valueOf(p.rankCode)),
    });
    pattern(p.vos, PATTERN.vosOther, {
      message: MESSAGE.vosOther,
      when: ({ valueOf }) => isRankWithVos(valueOf(p.rankCode)) && !isOfficer(valueOf(p.rankCode)),
    });
    pattern(p.accountingCategory, PATTERN.accountingCategory, {
      message: MESSAGE.accountingCategory,
    });
    pattern(p.registryNumber, PATTERN.registryNumber, { message: MESSAGE.registryNumber });
    pattern(p.militaryDocSeries, PATTERN.militaryDocSeries, { message: MESSAGE.militaryDocSeries });
    pattern(p.militaryDocNumber, PATTERN.militaryDocNumber, { message: MESSAGE.militaryDocNumber });
    pattern(p.militaryDocGeneratedAt, PATTERN.militaryDocGeneratedAt, {
      message: MESSAGE.militaryDocGeneratedAt,
    });
    required(p.tckId, {
      message: 'Оберіть ТЦК — без нього не сформується повідомлення',
      when: ({ valueOf }) => valueOf(p.militaryRegistered) && valueOf(p.rankCode) !== '',
    });
    required(p.reservationUntil, {
      message: 'Вкажіть строк бронювання',
      when: ({ valueOf }) => !!valueOf(p.reservationBasis),
    });
    required(p.reservationBasis, {
      message: 'Вкажіть підставу бронювання',
      when: ({ valueOf }) => !!valueOf(p.reservationUntil),
    });
    validate(p.demobilizedAt, ({ value, valueOf }) => {
      const mob = valueOf(p.mobilizedAt);
      return value() && mob && value() < mob
        ? { kind: 'order', message: 'Раніше за дату мобілізації' }
        : undefined;
    });

    // --- дати: коректний рік, не в майбутньому, не раніше народження
    for (const key of DATE_FIELDS) {
      validate(at(key), ({ value }) =>
        sensibleDate(value()) ? undefined : { kind: 'date', message: MESSAGE.invalidDate },
      );
    }
    for (const key of NOT_FUTURE_DATES) {
      validate(at(key), ({ value }) =>
        value() && value() > this.today
          ? { kind: 'future', message: MESSAGE.futureDate }
          : undefined,
      );
    }
    for (const key of AFTER_BIRTH_DATES) {
      validate(at(key), ({ value, valueOf }) => {
        const birth = valueOf(p.birthDate);
        return value() && birth && value() < birth
          ? { kind: 'beforeBirth', message: MESSAGE.beforeBirth }
          : undefined;
      });
    }

    // --- підстава змін для ТЦК
    required(p.changeEffectiveDate, {
      message: 'Вкажіть дату, з якої діють зміни',
      when: () => this.changedLabels().length > 0,
    });

    // --- сім’я
    applyEach(p.familyMembers, (m) => {
      required(m.lastName, { message: 'Вкажіть прізвище' });
      required(m.firstName, { message: 'Вкажіть ім’я' });
      pattern(m.lastName, PATTERN.name, { message: MESSAGE.name });
      pattern(m.firstName, PATTERN.name, { message: MESSAGE.name });
      pattern(m.middleName, PATTERN.name, { message: MESSAGE.name });
      maxLength(m.lastName, 100, { message: MESSAGE.tooLong(100) });
      maxLength(m.firstName, 100, { message: MESSAGE.tooLong(100) });
      maxLength(m.middleName, 100, { message: MESSAGE.tooLong(100) });
      validate(m.birthDate, ({ value }) => {
        if (!sensibleDate(value())) return { kind: 'date', message: MESSAGE.invalidDate };
        return value() && value() > this.today
          ? { kind: 'future', message: MESSAGE.futureDate }
          : undefined;
      });
    });
    validate(p.familyMembers, ({ value }) =>
      value().filter((m) => SPOUSES.includes(m.relation)).length > 1
        ? { kind: 'spouses', message: 'Чоловік/дружина може бути лише один' }
        : undefined,
    );
  });

  // ================================================================ помилки та навігація

  private field(key: string): FieldLike | undefined {
    return (this.f as unknown as Record<string, FieldLike | undefined>)[key];
  }

  private familyField(index: number, key: string): FieldLike | undefined {
    const member = (this.f.familyMembers as unknown as Record<number, Record<string, FieldLike>>)[
      index
    ];
    return member?.[key];
  }

  /** Усі помилки форми в порядку вкладок — для списку «Що виправити». */
  protected readonly errorList = computed<FormErrorItem[]>(() => {
    const items: FormErrorItem[] = [];
    for (const [key, meta] of Object.entries(FIELD_META)) {
      if (!meta) continue;
      const state = this.field(key)?.();
      for (const e of state?.errors() ?? []) {
        items.push({
          key,
          label: meta.label,
          message: e.message ?? 'Некоректне значення',
          tab: meta.tab,
        });
      }
      if (key === 'familyMembers') {
        this.model().familyMembers.forEach((_, index) => {
          for (const sub of ['lastName', 'firstName', 'middleName', 'birthDate']) {
            for (const e of this.familyField(index, sub)?.().errors() ?? []) {
              items.push({
                key: sub,
                index,
                label: `Член сім’ї ${index + 1}`,
                message: e.message ?? 'Некоректне значення',
                tab: 'family',
              });
            }
          }
        });
      }
    }
    return items;
  });

  /** Червона крапка на вкладці, де є помилка (після спроби збереження або дотику до поля). */
  protected readonly tabErrors = computed(() => {
    const result: Record<FormTab, boolean> = {
      personal: false,
      work: false,
      military: false,
      documents: false,
      family: false,
      notes: false,
    };
    for (const item of this.errorList()) {
      if (item.tab === 'sidebar') continue;
      const state =
        item.index === undefined
          ? this.field(item.key)?.()
          : this.familyField(item.index, item.key)?.();
      if (this.submitAttempted() || state?.touched()) result[item.tab] = true;
    }
    return result;
  });

  /** Перейти на вкладку з полем і поставити в нього курсор. */
  protected goTo(item: Pick<FormErrorItem, 'key' | 'tab' | 'index'>) {
    if (item.tab !== 'sidebar') this.tab.set(item.tab);
    afterNextRender(
      () => {
        const target =
          item.index === undefined ? this.field(item.key) : this.familyField(item.index, item.key);
        target?.().focusBoundControl({ preventScroll: false });
        if (typeof document !== 'undefined') {
          (document.activeElement as HTMLElement | null)?.scrollIntoView({
            block: 'center',
            behavior: 'smooth',
          });
        }
      },
      { injector: this.injector },
    );
  }

  private goToFirstError() {
    const first = this.errorList()[0];
    if (first) this.goTo(first);
  }

  // ================================================================ дії

  protected addFamilyMember(relation: FamilyRelation) {
    this.model.update((m) => ({
      ...m,
      familyMembers: [
        ...m.familyMembers,
        {
          relation,
          lastName: relation === 'HUSBAND' ? '' : m.lastName,
          firstName: '',
          middleName: '',
          birthDate: '',
        },
      ],
    }));
  }

  protected removeFamilyMember(index: number) {
    this.model.update((m) => ({
      ...m,
      familyMembers: m.familyMembers.filter((_, i) => i !== index),
    }));
  }

  protected relationLabel(relation: FamilyRelation) {
    return (
      this.dict.dictionaries()?.familyRelations.find((r) => r.value === relation)?.label ?? relation
    );
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.saveError.set('');
    this.serverErrors.set([]);
    this.submitAttempted.set(true);

    const ok = await submit(this.f, async () => {
      try {
        const payload = formToPayload(
          this.model(),
          this.isEdit() && this.changedLabels().length > 0,
        );
        const saved = this.isEdit()
          ? await this.employeesService.update(this.id()!, payload)
          : await this.employeesService.create(payload);
        const pending = saved.changes.filter((c) => !c.letter && !c.skipped).length;
        this.toast.success(pending ? `Збережено. У черзі для ТЦК: ${pending}` : 'Збережено');
        await this.router.navigate(['/employees', saved.id]);
        return undefined;
      } catch (err) {
        return this.mapServerErrors(err);
      }
    });

    if (!ok) {
      if (!this.saveError()) this.saveError.set('Не збережено — виправте позначені поля.');
      this.goToFirstError();
    }
  }

  /** Помилки валідації з API → помилки конкретних полів форми (з’являються під полем). */
  private mapServerErrors(err: unknown) {
    const body =
      err instanceof HttpErrorResponse
        ? (err.error as { errors?: { field: string; message: string }[] } | null)
        : null;
    if (!body?.errors?.length) {
      this.saveError.set(apiErrorMessage(err));
      return undefined;
    }
    const fieldErrors = [];
    const unmatched: string[] = [];
    for (const e of body.errors) {
      let node: unknown = this.f;
      for (const segment of apiPathToFormPath(e.field)) {
        node = (node as Record<string, unknown> | undefined)?.[
          /^\d+$/.test(segment) ? Number(segment) : segment
        ];
      }
      if (typeof node === 'function')
        fieldErrors.push({ fieldTree: node as never, kind: 'server', message: e.message });
      else unmatched.push(e.message);
    }
    this.serverErrors.set(unmatched);
    this.saveError.set('Сервер не прийняв дані — перевірте позначені поля.');
    return fieldErrors;
  }
}
