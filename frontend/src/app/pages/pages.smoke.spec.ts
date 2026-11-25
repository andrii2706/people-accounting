/**
 * Every page opens: rendered with fictional data, its template and the state it starts with work
 * (a broken binding or a missing provider fails here before a user sees a blank page).
 */
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { DictionariesService } from '../shared/services/dictionaries.service';
import { ToastService } from '../shared/services/toast.service';
import { authStub, dictionariesStub, listItem, toastStub } from '../testing/fixtures.testing';
import { DEFAULT_LABEL_SETTINGS } from '../shared/constants/label-settings.constants';
import { DEFAULT_LETTERHEAD_SETTINGS } from '../shared/constants/letterhead.constants';
import { PlansComponent } from './account/plans/plans.component';
import { SubscriptionComponent } from './account/subscription/subscription.component';
import { LegalEntityFormComponent } from './legal-entities/legal-entity-form/legal-entity-form.component';
import { ListsComponent } from './reports/lists/lists.component';
import { EntityDatabaseComponent } from './settings/entity-database/entity-database.component';
import { HrSyncComponent } from './settings/hr-sync/hr-sync.component';
import { LabelSettingsComponent } from './settings/label-settings/label-settings.component';
import { LetterheadComponent } from './settings/letterhead/letterhead.component';
import { OrganizationSettingsComponent } from './settings/organization-settings/organization-settings.component';
import { BillingSettingsComponent } from './vendor/billing-settings/billing-settings.component';
import { PricingComponent } from './vendor/pricing/pricing.component';
import { VendorSubscriptionsComponent } from './vendor/subscriptions/vendor-subscriptions.component';
import { AccountLayoutComponent } from './account/account-layout/account-layout.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ResetPasswordComponent } from './auth/reset-password/reset-password.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { EmployeeFormComponent } from './employees/employee-form/employee-form.component';
import { EmployeeImportComponent } from './employees/employee-import/employee-import.component';
import { EmployeePreviewComponent } from './employees/employee-preview/employee-preview.component';
import { LegalEntityListComponent } from './legal-entities/legal-entity-list/legal-entity-list.component';
import { LetterListComponent } from './letters/letter-list/letter-list.component';
import { NoEntityComponent } from './no-entity/no-entity.component';
import { NoModuleComponent } from './no-module/no-module.component';
import { ProfileComponent } from './profile/profile.component';
import { ExtractsComponent } from './reports/extracts/extracts.component';
import { OperationalComponent } from './reports/operational/operational.component';
import { SecurityComponent } from './settings/security/security.component';
import { SignupsComponent } from './settings/signups/signups.component';
import { VendorLayoutComponent } from './vendor/vendor-layout/vendor-layout.component';

const ROW = {
  code: '1.',
  title: 'Військовозобов’язані',
  total: 3,
  mobilizationOrders: 0,
  reserved: 1,
  other: 2,
  hiredSince2020: 3,
  dismissedSince2020: 1,
};

const STATUS = {
  mailConfigured: true,
  recipients: 2,
  mobilizationUntil: '2027-02-05',
  mobilizationDecree: '',
  mobilizationEstimated: false,
  mobilizationConfirmedUntil: '2027-02-05',
  mobilizationCheckedAt: null,
};
const ENTITY = {
  id: 'le1',
  fullName: 'ТОВ «Вигадана компанія»',
  shortName: 'Вигадана компанія',
  edrpou: '12345678',
};
const HR_SETTINGS = {
  configured: true,
  system: 'ZUP',
  mode: 'PUSH',
  frequency: 'ONGOING',
  completedAt: null,
  pushWindowUntil: null,
  odataUrl: '',
  odataUser: '',
  hasOdataPassword: false,
  organizationCode: '',
  scheduleEnabled: false,
  scheduleHour: 6,
  autoApply: true,
  militaryPolicy: 'FILL_EMPTY',
  importDismissed: false,
  tokenPrefix: 'mr1c_0000',
  tokenIssuedAt: '2026-11-01T10:00:00Z',
  tokenExpiresAt: null,
  pushAllowedIps: '',
  lastRunAt: null,
  lastStatus: null,
  lastMessage: '',
  pushUrl: '/api/integrations/1c/employees',
  allowPrivateHosts: false,
};
const SELLER = {
  name: 'ФОП Вигаданий',
  code: '1234567890',
  ipn: '',
  address: 'м. Тестове',
  iban: 'UA000000000000000000000000000',
  bank: 'Тестовий банк',
  phone: '',
  email: 'billing@example.com',
  taxNote: '',
  vatPayer: false,
  signerName: 'Вигаданий Постачальник',
  signerPosition: 'ФОП',
};
const SUBSCRIPTION = {
  required: true,
  state: 'TRIAL',
  plan: 'MONTHLY',
  trialUntil: '2026-12-01',
  paidUntil: null,
  daysLeft: 7,
  enterpriseRequestedAt: null,
  plans: [
    {
      plan: 'MONTHLY',
      label: 'Місячний',
      price: 500,
      period: 'місяць',
      description: 'Оплата щомісяця',
    },
  ],
  invoices: [],
  canManage: true,
  sellerReady: true,
};
const LABEL = { name: 'Вигадана компанія', lines: ['м. Тестове'], postalCode: '01001' };

/** [page, inputs, a text the page must show]. */
const PAGES: [string, Type<unknown>, Record<string, unknown>, string | RegExp][] = [
  ['Вхід', LoginComponent, {}, /Військов/],
  ['Реєстрація юрособи', RegisterComponent, {}, /.+/],
  ['Новий пароль за посиланням', ResetPasswordComponent, {}, /.+/],
  ['Огляд', DashboardComponent, {}, /.+/],
  ['Нова картка працівника', EmployeeFormComponent, {}, /Прізвище/],
  ['Імпорт працівників', EmployeeImportComponent, {}, /.+/],
  ['Перегляд працівника збоку', EmployeePreviewComponent, { item: listItem() }, /Вигаданий/],
  ['Юридичні особи', LegalEntityListComponent, { entities: [] }, /.+/],
  ['Вихідні листи', LetterListComponent, { letters: [] }, /.+/],
  ['Без юрособи', NoEntityComponent, {}, /.+/],
  ['Модуль не підключено', NoModuleComponent, {}, /.+/],
  ['Профіль', ProfileComponent, {}, /.+/],
  ['Витяги', ExtractsComponent, { extracts: [] }, /.+/],
  [
    'Відомість оперативного обліку',
    OperationalComponent,
    { report: { date: '2026-11-24', rows: [ROW, { ...ROW, code: '2.' }] } },
    /.+/,
  ],
  ['Журнал безпеки', SecurityComponent, {}, /.+/],
  ['Спроби реєстрації', SignupsComponent, { rows: [] }, /.+/],
  ['Обліковий запис', AccountLayoutComponent, {}, /.*/],
  ['Постачальник', VendorLayoutComponent, {}, /.*/],
  [
    'Нова юрособа',
    LegalEntityFormComponent,
    {
      page: {
        entity: null,
        people: { HEAD: null, RESPONSIBLE: null },
        status: STATUS,
        quota: null,
      },
    },
    /.+/,
  ],
  ['Сформовані списки', ListsComponent, { page: { snapshots: [], report: null } }, /.+/],
  [
    'Інтеграція з 1С',
    HrSyncComponent,
    {
      data: {
        entityId: 'le1',
        entityName: 'Вигадана компанія',
        edrpou: '12345678',
        settings: HR_SETTINGS,
        history: [],
      },
    },
    /1С/,
  ],
  [
    'Своя база даних',
    EntityDatabaseComponent,
    {
      data: {
        entityId: 'le1',
        entityName: 'Вигадана компанія',
        db: {
          configured: false,
          host: '',
          port: 5432,
          database: '',
          username: '',
          hasPassword: false,
          sslMode: 'require',
          status: 'UNKNOWN',
          lastCheckedAt: null,
          lastError: '',
          serverVersion: '',
          canCreate: true,
          allowPlainText: false,
        },
      },
    },
    /.+/,
  ],
  [
    'Загальні налаштування',
    OrganizationSettingsComponent,
    {
      settings: {
        organization: { alertDays: 30, notifyDeadlineDays: 7, mobilizationUntil: '2027-02-05' },
        status: STATUS,
      },
    },
    /.+/,
  ],
  [
    'Бланк листів',
    LetterheadComponent,
    {
      data: {
        entityId: 'le1',
        entityName: 'Вигадана компанія',
        settings: DEFAULT_LETTERHEAD_SETTINGS,
        requisites: { ...ENTITY, address: 'м. Тестове', postalCode: '01001', phone: '', email: '' },
      },
    },
    /.+/,
  ],
  [
    'Наклейки на конверти',
    LabelSettingsComponent,
    {
      data: {
        entityId: 'le1',
        entityName: 'Вигадана компанія',
        settings: DEFAULT_LABEL_SETTINGS,
        sample: { sender: LABEL, recipient: LABEL },
      },
    },
    /.+/,
  ],
  ['Підписка', SubscriptionComponent, { data: SUBSCRIPTION }, /.+/],
  ['Тарифи', PlansComponent, { data: SUBSCRIPTION }, /.+/],
  [
    'Ціни й реквізити постачальника',
    PricingComponent,
    {
      settings: {
        seller: SELLER,
        monthlyPrice: 500,
        yearlyPrice: 5000,
        enterpriseText: '',
        serviceName: 'Доступ',
        invoicePrefix: 'ВО',
        dueDays: 5,
        trialDays: 14,
        ready: true,
      },
    },
    /.+/,
  ],
  [
    'Підписки клієнтів',
    VendorSubscriptionsComponent,
    { data: { subscriptions: [], invoices: [] } },
    /.+/,
  ],
  [
    'Борг за користування',
    BillingSettingsComponent,
    {
      record: {
        hasDebt: false,
        message: '',
        paymentContact: '',
        debtSetAt: null,
        updatedAt: null,
        updatedBy: '',
        graceUsedBy: 0,
      },
    },
    /.+/,
  ],
];

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub() },
      { provide: DictionariesService, useValue: dictionariesStub() },
      { provide: ToastService, useValue: toastStub() },
    ],
  });
});

describe('Сторінки відкриваються', () => {
  for (const [name, page, inputs, text] of PAGES) {
    it(name, () => {
      const fixture = TestBed.createComponent(page);
      for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent ?? '').toMatch(text);
    });
  }
});
