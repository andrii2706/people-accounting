import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  untracked,
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
  emptyDocument,
  employeeToForm,
  emptyEmployeeForm,
  emptyEducation,
  emptyPosition,
  formToPayload,
  copyEmployeeToForm,
  hasDeferral,
  normalizeTime,
  reportableChanges,
} from '../../../shared/utils/employee-form.utils';
import {
  changedCount,
  completion,
  sectionKeyFields,
} from '../../../shared/utils/employee-form-sections.utils';
import {
  ALL_DATE_FIELDS,
  FIELD_META,
  FORM_TABS,
  LIST_ITEM_FIELDS,
  ORDER_DOC_NAMES,
  SPOUSES,
} from '../../../shared/constants/employee-form.constants';
import { sensibleDate } from '../../../shared/utils/date.utils';
import { httpResource } from '@angular/common/http';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { FamilyRelation } from '../../../shared/interfaces/dictionary.interface';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeesService } from '../../../shared/services/employees.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  apiErrorMessage,
  apiFieldErrors,
  bindApiErrors,
} from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { matchTck } from '../../../shared/utils/tck-match.utils';
import {
  AFTER_BIRTH_DATES,
  MAX_LENGTH,
  MESSAGE,
  NOT_FUTURE_DATES,
  PATTERN,
  rnokppMismatch,
  isElectronicDocType,
} from '../../../shared/validators/employee-rules';
import type { SelectOption } from '../../../shared/interfaces/ui.interface';
import type {
  FormTab,
  DeferralKind,
  EmployeeFormModel,
  FormFieldRef,
  FormListKey,
  FormErrorItem,
} from '../../../shared/interfaces/employee-form.interface';
import type { NotificationStatus } from '../../../shared/interfaces/organization.interface';

@Component({
  selector: 'app-employee-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormFieldComponent,
    RouterLink,
    IconComponent,
    DateInputComponent,
    SelectComponent,
  ],
  templateUrl: './employee-form.component.html',
})
export class EmployeeFormComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  protected readonly dict = inject(DictionariesService);

  /** :id from the route; undefined for /employees/new. */
  readonly id = input<string>();

  protected readonly tabs = FORM_TABS;
  protected readonly tab = signal<FormTab>('personal');
  protected readonly saveError = signal('');
  /** Server errors that could not be bound to a specific field. */
  protected readonly serverErrors = signal<string[]>([]);
  protected readonly submitAttempted = signal(false);
  private readonly today = todayIso();

  /** For editing — data from employeeDetailsResolver; absent for a new employee. */
  readonly employee = input<EmployeeDetails>();
  protected readonly isEdit = computed(() => !!this.id());

  /** Original state (to detect changes) and the edited model — both derived from the loaded employee. */
  private readonly original = computed(() => {
    const e = this.employee();
    return e ? employeeToForm(e, this.today) : null;
  });
  /** «Копіювати»: the card the new one is prefilled from (employeeCopyResolver). */
  readonly source = input<EmployeeDetails | null>(null);
  protected readonly model = linkedSignal<EmployeeFormModel>(() => {
    const source = this.source();
    return (
      this.original() ??
      (source ? copyEmployeeToForm(source, this.today) : emptyEmployeeForm(this.today))
    );
  });

  protected readonly changedLabels = computed(() =>
    reportableChanges(this.original(), this.model()),
  );

  protected readonly rank = computed(() => {
    const code = this.model().rankCode;
    return code === '' ? undefined : this.dict.rank(Number(code));
  });
  protected readonly isOfficer = computed(() => (this.rank()?.code ?? -1) >= 12);
  protected readonly isConscript = computed(() => this.rank()?.code === 0);
  protected readonly isReservist = computed(() => !!this.model().reserveTeamNumber.trim());
  /** ВЛК dates are kept for employees with a deferral (not for reserved ones). */
  protected readonly withDeferral = computed(() => hasDeferral(this.model()));
  /** The ВЛК block is also shown when a ВЛК date was filled in earlier, so it is not hidden. */
  protected readonly showVlk = computed(() => this.withDeferral() || !!this.model().fitnessDate);
  protected readonly isIdCard = computed(() => this.model().passportType === 'ID_CARD');
  /** VOS depends on the rank: 6 characters for officers, 3 for the others, none for conscripts. */
  protected readonly vosHint = computed(() =>
    !this.rank()
      ? 'Спершу оберіть звання'
      : this.isConscript()
        ? 'Для призовників не заповнюється'
        : this.isOfficer()
          ? '6 цифр, напр. 021101 або 021101А'
          : '3 або 6 цифр, напр. 100, 100915 або 837А',
  );
  /** Rank-and-file, sergeants, petty officers — «категорія обліку»; officers — «розряд». */
  protected readonly categoryLabel = computed(() =>
    this.isOfficer() ? 'Розряд' : 'Категорія обліку',
  );
  protected readonly orderDocNames = ORDER_DOC_NAMES;

  /** Term of general mobilization (from the presidential decrees) — for deferrals «до завершення мобілізації». */
  /**
   * TCK from «Ким виданий» of a military document: filled in automatically when that TCK is in the directory
   * and the field is still empty; when it is not found, the field stays empty. Acts only when «Ким виданий»
   * changes (or on opening the card), so a TCK cleared by hand is not put back.
   */
  protected readonly tckAutoFilled = signal(false);
  private lastIssuedBy: string | null = null;
  private readonly autoTck = effect(() => {
    const issuedBy = this.model().militaryDocuments.map((d) => d.issuedBy.trim());
    const tcks = this.dict.activeTcks();
    const key = issuedBy.join('\n');
    if (!tcks.length || key === this.lastIssuedBy) return;
    this.lastIssuedBy = key;
    untracked(() => {
      if (this.model().tckId) return;
      for (const text of issuedBy) {
        const id = matchTck(text, tcks);
        if (id) {
          this.model.update((m) => ({ ...m, tckId: id }));
          this.tckAutoFilled.set(true);
          return;
        }
      }
    });
  });

  /** Men are on military registration by default: choosing «чоловіча» in a new card ticks the box. */
  private lastGender: string | null = null;
  private readonly menRegistered = effect(() => {
    const gender = this.model().gender;
    if (gender === this.lastGender) return;
    const first = this.lastGender === null;
    this.lastGender = gender;
    if (first || this.isEdit() || gender !== 'M') return;
    untracked(() => this.model.update((m) => ({ ...m, militaryRegistered: true })));
  });

  /** Choosing an electronic document type clears its series and number (they are locked). */
  private lastDocTypes: string | null = null;
  private readonly electronicDocs = effect(() => {
    const types = this.model().militaryDocuments.map((d) => d.type);
    const key = types.join('\n');
    const first = this.lastDocTypes === null;
    if (key === this.lastDocTypes) return;
    this.lastDocTypes = key;
    if (first) return;
    untracked(() => {
      const docs = this.model().militaryDocuments;
      if (!docs.some((d) => isElectronicDocType(d.type) && (d.number || d.series))) return;
      this.model.update((m) => ({
        ...m,
        militaryDocuments: m.militaryDocuments.map((d) =>
          isElectronicDocType(d.type) ? { ...d, number: '', series: '' } : d,
        ),
      }));
    });
  });

  protected readonly mobilization = httpResource<NotificationStatus>(
    () => '/api/notifications/status',
  );

  protected readonly rankOptions = computed<SelectOption[]>(() =>
    this.dict.ranks().map((r) => ({
      value: String(r.code),
      label: this.model().navy ? r.navy : r.army,
      hint: r.compositionLabel,
    })),
  );
  protected readonly tckOptions = computed<SelectOption[]>(() =>
    this.dict.activeTcks().map((t) => ({ value: t.id, label: t.name })),
  );
  protected readonly docTypeOptions = computed<SelectOption[]>(() =>
    (this.dict.dictionaries()?.militaryDocumentTypes ?? []).map((t) => ({ value: t, label: t })),
  );
  protected readonly fitnessOptions = computed<SelectOption[]>(() =>
    (this.dict.dictionaries()?.fitnessStatuses ?? []).map((t) => ({ value: t, label: t })),
  );
  protected readonly educationOptions = computed<SelectOption[]>(() =>
    (this.dict.dictionaries()?.educationLevels ?? []).map((t) => ({ value: t, label: t })),
  );
  protected readonly maritalOptions = computed<SelectOption[]>(() =>
    (this.dict.dictionaries()?.maritalStatuses ?? []).map((m) => ({
      value: m.value,
      label: this.model().gender === 'F' ? m.labelF : m.labelM,
    })),
  );
  protected readonly genderOptions: SelectOption[] = [
    { value: 'M', label: 'чоловіча' },
    { value: 'F', label: 'жіноча' },
  ];
  protected readonly passportTypeOptions: SelectOption[] = [
    { value: 'ID_CARD', label: 'ID-картка' },
    { value: 'BOOK', label: 'Паспорт-книжечка' },
  ];
  /** Preliminary calculation of category and group — the same logic as on the server. */
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
    // conscripts — group 4 regardless of gender (women conscripts are counted with all conscripts)
    const section = this.isConscript()
      ? 'CONSCRIPTS'
      : m.gender === 'F'
        ? 'WOMEN'
        : this.isOfficer()
          ? 'OFFICERS'
          : 'SOLDIERS';
    const title =
      this.dict.dictionaries()?.listSections?.find((s) => s.value === section)?.label ?? section;
    return { category, group: `Списки ${title}` };
  });

  protected readonly rnokppHint = computed(() => {
    const m = this.model();
    return rnokppMismatch(m.rnokpp, m.birthDate, m.gender);
  });

  protected readonly f = form(this.model, (p) => {
    const at = (key: string) => (p as unknown as Record<string, SchemaPath<string>>)[key];
    const isOfficer = (rank: string) => rank !== '' && Number(rank) >= 12;
    const isRankWithVos = (rank: string) => rank !== '' && rank !== '0';
    const isConscriptRank = (rank: string) => rank === '0';

    // lengths match the DB columns (the input will not accept more)
    const modelKeys = new Set(Object.keys(emptyEmployeeForm(this.today)));
    for (const [key, max] of Object.entries(MAX_LENGTH)) {
      if (modelKeys.has(key)) maxLength(at(key), max, { message: MESSAGE.tooLong(max) });
    }

    required(p.lastName, { message: 'Вкажіть прізвище' });
    required(p.firstName, { message: 'Вкажіть ім’я' });
    pattern(p.lastName, PATTERN.name, { message: MESSAGE.name });
    pattern(p.firstName, PATTERN.name, { message: MESSAGE.name });
    pattern(p.middleName, PATTERN.name, { message: MESSAGE.name });
    pattern(p.rnokpp, PATTERN.rnokpp, { message: MESSAGE.rnokpp });
    pattern(p.phone, PATTERN.phone, { message: MESSAGE.phone });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });

    // passport: rules depend on the document type
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

    applyEach(p.positions, (pos) => {
      required(pos.position, { message: 'Вкажіть посаду' });
      maxLength(pos.position, MAX_LENGTH.position, {
        message: MESSAGE.tooLong(MAX_LENGTH.position),
      });
      maxLength(pos.department, MAX_LENGTH.department, {
        message: MESSAGE.tooLong(MAX_LENGTH.department),
      });
      maxLength(pos.orderDocName, MAX_LENGTH.orderDocName, {
        message: MESSAGE.tooLong(MAX_LENGTH.orderDocName),
      });
      maxLength(pos.orderNumber, MAX_LENGTH.orderNumber, {
        message: MESSAGE.tooLong(MAX_LENGTH.orderNumber),
      });
      for (const d of [pos.since, pos.orderDate]) {
        validate(d, ({ value }) =>
          sensibleDate(value()) ? undefined : { kind: 'date', message: MESSAGE.invalidDate },
        );
      }
      validate(pos.since, ({ value }) => {
        const hire = this.model().hireDate;
        return value() && hire && value() < hire
          ? { kind: 'order', message: 'Раніше за дату прийняття' }
          : undefined;
      });
    });
    validate(p.dismissalDate, ({ value, valueOf }) => {
      const hire = valueOf(p.hireDate);
      return value() && hire && value() < hire
        ? { kind: 'order', message: 'Раніше за дату прийняття' }
        : undefined;
    });
    required(p.dismissalOrderNumber, {
      message: 'Вкажіть номер документа про звільнення',
      when: ({ valueOf }) => !!valueOf(p.dismissalDate) && !!valueOf(p.dismissalOrderDate),
    });

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
    // VOS follows the rank: not before the rank is chosen, not for conscripts
    disabled(p.vos, ({ valueOf }) =>
      valueOf(p.rankCode) === ''
        ? 'Спершу оберіть звання'
        : isConscriptRank(valueOf(p.rankCode))
          ? 'Для призовників не заповнюється'
          : false,
    );
    disabled(p.trainingProfile, ({ valueOf }) =>
      isOfficer(valueOf(p.rankCode)) ? false : 'Лише для офіцерів',
    );
    applyEach(p.militaryDocuments, (doc) => {
      for (const f of [doc.series, doc.number]) {
        disabled(f, ({ valueOf }) =>
          isElectronicDocType(valueOf(doc.type))
            ? 'Електронний документ не має серії й номера'
            : false,
        );
      }
      maxLength(doc.type, MAX_LENGTH.docType, { message: MESSAGE.tooLong(MAX_LENGTH.docType) });
      maxLength(doc.series, MAX_LENGTH.docSeries, {
        message: MESSAGE.tooLong(MAX_LENGTH.docSeries),
      });
      maxLength(doc.number, MAX_LENGTH.docNumber, {
        message: MESSAGE.tooLong(MAX_LENGTH.docNumber),
      });
      maxLength(doc.issuedBy, MAX_LENGTH.docIssuedBy, {
        message: MESSAGE.tooLong(MAX_LENGTH.docIssuedBy),
      });
      pattern(doc.series, PATTERN.docSeries, { message: MESSAGE.docSeries });
      pattern(doc.number, PATTERN.docNumber, { message: MESSAGE.docNumber });
      validate(doc.generatedTime, ({ value }) =>
        value() && !PATTERN.docGeneratedTime.test(normalizeTime(value()))
          ? { kind: 'time', message: MESSAGE.docGeneratedTime }
          : undefined,
      );
      required(doc.type, {
        message: 'Оберіть тип документа',
        when: ({ valueOf }) => !!valueOf(doc.number) || !!valueOf(doc.series),
      });
      for (const d of [doc.issuedAt, doc.generatedDate]) {
        validate(d, ({ value }) => {
          if (!sensibleDate(value())) return { kind: 'date', message: MESSAGE.invalidDate };
          return value() && value() > this.today
            ? { kind: 'future', message: MESSAGE.futureDate }
            : undefined;
        });
      }
    });
    required(p.tckId, {
      message: 'Оберіть ТЦК — без нього не сформується повідомлення',
      when: ({ valueOf }) => valueOf(p.militaryRegistered) && valueOf(p.rankCode) !== '',
    });
    // same rules as applyReservation() on the backend: for another legal entity everything is optional
    pattern(p.reservedByEdrpou, PATTERN.edrpou, { message: MESSAGE.edrpou });
    required(p.reservationUntil, {
      message: 'Вкажіть строк бронювання',
      when: ({ valueOf }) =>
        valueOf(p.reserved) &&
        valueOf(p.reservedBy) !== 'OTHER' &&
        !isConscriptRank(valueOf(p.rankCode)),
    });
    // deferral: blocked for a reserved employee; one kind only
    const reservedMsg = 'Працівник заброньований — відстрочка не застосовується';
    disabled(p.deferralConscriptionBasis, ({ valueOf }) =>
      valueOf(p.reserved) ? reservedMsg : false,
    );
    disabled(p.deferralMobilizationBasis, ({ valueOf }) =>
      valueOf(p.reserved) ? reservedMsg : false,
    );
    disabled(p.deferralUntil, ({ valueOf }) =>
      valueOf(p.reserved)
        ? reservedMsg
        : valueOf(p.deferralKind) === 'MOBILIZATION' && valueOf(p.deferralUntilMobilizationEnd)
          ? 'До завершення мобілізації'
          : false,
    );
    required(p.deferralConscriptionBasis, {
      message: 'Вкажіть підставу відстрочки',
      when: ({ valueOf }) => !valueOf(p.reserved) && valueOf(p.deferralKind) === 'CONSCRIPTION',
    });
    required(p.deferralMobilizationBasis, {
      message: 'Вкажіть підставу відстрочки',
      when: ({ valueOf }) => !valueOf(p.reserved) && valueOf(p.deferralKind) === 'MOBILIZATION',
    });
    validate(p.demobilizedAt, ({ value, valueOf }) => {
      const mob = valueOf(p.mobilizedAt);
      return value() && mob && value() < mob
        ? { kind: 'order', message: 'Раніше за дату мобілізації' }
        : undefined;
    });

    // dates: valid year, not in the future, not before birth
    for (const key of ALL_DATE_FIELDS) {
      validate(at(key), ({ value }) =>
        sensibleDate(value()) ? undefined : { kind: 'date', message: MESSAGE.invalidDate },
      );
    }
    // education dates are checked per entry of the list (below)
    for (const key of NOT_FUTURE_DATES.filter((k) => k !== 'educationDocumentDate')) {
      validate(at(key), ({ value }) =>
        value() && value() > this.today
          ? { kind: 'future', message: MESSAGE.futureDate }
          : undefined,
      );
    }
    for (const key of AFTER_BIRTH_DATES.filter((k) => k !== 'educationDocumentDate')) {
      validate(at(key), ({ value, valueOf }) => {
        const birth = valueOf(p.birthDate);
        return value() && birth && value() < birth
          ? { kind: 'beforeBirth', message: MESSAGE.beforeBirth }
          : undefined;
      });
    }

    disabled(p.nextVlkDate, () =>
      this.withDeferral() ? false : 'Лише для працівників з відстрочкою',
    );
    validate(p.nextVlkDate, ({ value, valueOf }) => {
      const passed = valueOf(p.fitnessDate);
      return value() && passed && value() <= passed
        ? { kind: 'order', message: 'Наступна ВЛК має бути пізніше за дату проходження' }
        : undefined;
    });

    required(p.changeEffectiveDate, {
      message: 'Вкажіть дату, з якої діють зміни',
      when: () => this.changedLabels().length > 0,
    });

    applyEach(p.educations, (ed) => {
      maxLength(ed.level, MAX_LENGTH.educationLevel, {
        message: MESSAGE.tooLong(MAX_LENGTH.educationLevel),
      });
      maxLength(ed.institution, MAX_LENGTH.educationInstitution, {
        message: MESSAGE.tooLong(MAX_LENGTH.educationInstitution),
      });
      maxLength(ed.specialty, MAX_LENGTH.educationSpecialty, {
        message: MESSAGE.tooLong(MAX_LENGTH.educationSpecialty),
      });
      maxLength(ed.document, MAX_LENGTH.educationDocument, {
        message: MESSAGE.tooLong(MAX_LENGTH.educationDocument),
      });
      required(ed.level, {
        message: 'Оберіть рівень освіти',
        when: ({ valueOf }) =>
          !!(valueOf(ed.institution) || valueOf(ed.specialty) || valueOf(ed.document)),
      });
      validate(ed.documentDate, ({ value, valueOf }) => {
        if (!sensibleDate(value())) return { kind: 'date', message: MESSAGE.invalidDate };
        if (value() && value() > this.today) return { kind: 'future', message: MESSAGE.futureDate };
        const birth = valueOf(p.birthDate);
        return value() && birth && value() < birth
          ? { kind: 'beforeBirth', message: MESSAGE.beforeBirth }
          : undefined;
      });
    });

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

  private field(key: string): FormFieldRef | undefined {
    return (this.f as unknown as Record<string, FormFieldRef | undefined>)[key];
  }

  private listField(list: FormListKey, index: number, key: string): FormFieldRef | undefined {
    const item = (this.f[list] as unknown as Record<number, Record<string, FormFieldRef>>)[index];
    return item?.[key];
  }

  private itemField(item: Pick<FormErrorItem, 'key' | 'list' | 'index'>) {
    return item.list === undefined || item.index === undefined
      ? this.field(item.key)
      : this.listField(item.list, item.index, item.key);
  }

  /** All form errors in tab order — for the "what to fix" list. */
  protected readonly errorList = computed<FormErrorItem[]>(() => {
    const items: FormErrorItem[] = [];
    const model = this.model();
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
      if (key in LIST_ITEM_FIELDS) {
        const list = key as FormListKey;
        const { item, fields } = LIST_ITEM_FIELDS[list];
        model[list].forEach((_, index) => {
          for (const sub of fields) {
            for (const e of this.listField(list, index, sub)?.().errors() ?? []) {
              items.push({
                key: sub,
                list,
                index,
                label: `${item} ${index + 1}`,
                message: e.message ?? 'Некоректне значення',
                tab: meta.tab,
              });
            }
          }
        });
      }
    }
    return items;
  });

  /** Section menu: errors, filled state, overall completion, unsaved changes. */
  protected readonly sections = computed(() => {
    const keys = sectionKeyFields(this.model());
    const errors = new Map<string, number>();
    for (const item of this.errorList()) {
      if (item.tab === 'sidebar') continue;
      if (this.submitAttempted() || this.itemField(item)?.().touched())
        errors.set(item.tab, (errors.get(item.tab) ?? 0) + 1);
    }
    return FORM_TABS.map((t) => {
      const fields = keys[t.id];
      const missing = fields.filter((v) => !v).length;
      return {
        ...t,
        errors: errors.get(t.id) ?? 0,
        missing,
        complete: fields.length > 0 && missing === 0,
      };
    });
  });
  protected readonly completion = computed(() => completion(this.model()));
  protected readonly currentSectionLabel = computed(
    () => FORM_TABS.find((t) => t.id === this.tab())?.label ?? '',
  );
  protected readonly unsaved = computed(() => changedCount(this.original(), this.model()));
  protected readonly visibleErrors = computed(() =>
    this.sections().reduce((sum, s) => sum + s.errors, 0),
  );
  protected readonly initials = computed(() =>
    `${this.model().lastName.charAt(0)}${this.model().firstName.charAt(0)}`.toUpperCase(),
  );

  protected cancel() {
    const e = this.employee();
    void this.router.navigate(e ? ['/employees', e.id] : ['/employees']);
  }

  /** Red dot on a tab with an error (after a save attempt or touching the field). */
  protected readonly tabErrors = computed(() => {
    const result = Object.fromEntries(FORM_TABS.map((t) => [t.id, false])) as Record<
      FormTab,
      boolean
    >;
    for (const item of this.errorList()) {
      if (item.tab === 'sidebar') continue;
      if (this.submitAttempted() || this.itemField(item)?.().touched()) result[item.tab] = true;
    }
    return result;
  });

  /** Switch to the tab with the field and focus it. */
  protected goTo(item: Pick<FormErrorItem, 'key' | 'tab' | 'list' | 'index'>) {
    if (item.tab !== 'sidebar') this.tab.set(item.tab);
    afterNextRender(
      () => {
        this.itemField(item)?.().focusBoundControl({ preventScroll: false });
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

  protected addDocument() {
    this.model.update((m) => ({
      ...m,
      militaryDocuments: [...m.militaryDocuments, emptyDocument()],
    }));
  }

  protected removeDocument(index: number) {
    this.model.update((m) => ({
      ...m,
      militaryDocuments: m.militaryDocuments.filter((_, i) => i !== index),
    }));
  }

  /** A transfer: a new position from today (the latest entry is the current position). */
  protected addPosition() {
    this.model.update((m) => {
      const last = m.positions.at(-1);
      return {
        ...m,
        positions: [
          ...m.positions,
          { ...emptyPosition(this.today), department: last?.department ?? '' },
        ],
      };
    });
  }

  protected removePosition(index: number) {
    this.model.update((m) => ({ ...m, positions: m.positions.filter((_, i) => i !== index) }));
  }

  protected setDeferralKind(kind: DeferralKind) {
    this.model.update((m) => ({ ...m, deferralKind: kind }));
  }

  protected addEducation() {
    this.model.update((m) => ({ ...m, educations: [...m.educations, emptyEducation()] }));
  }

  protected removeEducation(index: number) {
    this.model.update((m) => ({ ...m, educations: m.educations.filter((_, i) => i !== index) }));
  }

  protected isElectronic(type: string) {
    return isElectronicDocType(type);
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

  /** API validation errors → errors of specific form fields (shown under the field). */
  private mapServerErrors(err: unknown) {
    if (!apiFieldErrors(err).length) {
      this.saveError.set(apiErrorMessage(err));
      return undefined;
    }
    const { fieldErrors, unmatched } = bindApiErrors<never>(err, this.f, apiPathToFormPath);
    this.serverErrors.set(unmatched);
    this.saveError.set('Сервер не прийняв дані — перевірте позначені поля.');
    return fieldErrors;
  }
}
