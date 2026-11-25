import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { httpContract } from '../../testing/http-contract.testing';
import { AccountService } from './account.service';
import { LegalEntitiesService } from './legal-entities.service';
import { BillingService } from './billing.service';
import { EmployeeImportService } from './employee-import.service';
import { EmployeesService } from './employees.service';
import { EntityDatabaseService } from './entity-database.service';
import { HrSyncService } from './hr-sync.service';
import { LettersService } from './letters.service';
import { ListsService } from './lists.service';
import { ReportsService } from './reports.service';
import { SecurityService } from './security.service';
import { SignaturesService } from './signatures.service';
import { TwoFactorService } from './two-factor.service';
import { UsersService } from './users.service';
import { VendorBillingService } from './vendor-billing.service';

// all ids and people are fictional
const E = 'e1';
const L = 'l1';
const LE = 'le1';

httpContract('EmployeesService', EmployeesService, [
  {
    name: 'список',
    run: (s) => s.list({ status: 'dismissed' }),
    method: 'GET',
    url: 'api/employees',
    params: { status: 'dismissed' },
  },
  { name: 'картка', run: (s) => s.details(E), method: 'GET', url: `api/employees/${E}` },
  {
    name: 'черга змін',
    run: (s) => s.pendingChanges(),
    method: 'GET',
    url: 'api/employees/changes/pending',
    response: [],
  },
  {
    name: 'нова картка',
    run: (s) => s.create({ lastName: 'Вигаданий' } as never),
    method: 'POST',
    url: 'api/employees',
    body: { lastName: 'Вигаданий' },
  },
  {
    name: 'зміна з датою й «не повідомляти»',
    run: (s) =>
      s.update(E, {
        phone: '+380500000000',
        changeMeta: { effectiveDate: '2026-11-24', notify: false },
      } as never),
    method: 'PATCH',
    url: `api/employees/${E}`,
    body: { changeMeta: { effectiveDate: '2026-11-24', notify: false } },
  },
  {
    name: 'звільнення',
    run: (s) => s.dismiss(E, { dismissalDate: '2026-11-24' }),
    method: 'POST',
    url: `api/employees/${E}/dismiss`,
    body: { dismissalDate: '2026-11-24' },
  },
  {
    name: 'хто без ТЦК, але з документом від нього',
    run: (s) => s.tckMatches('t1'),
    method: 'GET',
    url: 'api/employees/tck-matches/t1',
    response: [],
  },
  {
    name: 'підтягнути ТЦК у картки',
    run: (s) => s.assignTck('t1', [E]),
    method: 'POST',
    url: 'api/employees/tck-assign',
    body: { tckId: 't1', employeeIds: [E] },
    response: { assigned: 1 },
  },
  {
    name: 'підстава зміни',
    run: (s) => s.updateChange('c1', { basis: 'заява' } as never),
    method: 'PATCH',
    url: 'api/employees/changes/c1',
    body: { basis: 'заява' },
  },
]);

httpContract('LettersService', LettersService, [
  {
    name: 'реєстр листів',
    run: (s) => s.list({ year: '2026' }),
    method: 'GET',
    url: 'api/letters',
    params: { year: '2026' },
    response: [],
  },
  { name: 'лист', run: (s) => s.details(L), method: 'GET', url: `api/letters/${L}` },
  {
    name: 'об’єднані листи за ТЦК',
    run: (s) => s.createChangeNotices([E], ['c1']),
    method: 'POST',
    url: 'api/letters/change-notices',
    body: { employeeIds: [E], changeIds: ['c1'] },
    response: [],
  },
  {
    name: 'повідомлення працівника',
    run: (s) => s.employeeNotices(E),
    method: 'GET',
    url: 'api/change-notices',
    params: { employeeId: E },
    response: [],
  },
  {
    name: 'наклейки для друку',
    run: (s) => s.labelPrintData([L, 'l2']),
    method: 'GET',
    url: 'api/letters/labels/print',
    params: { ids: `${L},l2` },
  },
  {
    name: 'лист одному працівнику',
    run: (s) => s.createChangeNotice(E),
    method: 'POST',
    url: 'api/letters/change-notice',
    body: { employeeId: E },
  },
  {
    name: 'списки / відомість',
    run: (s) => s.createReport({ type: 'LISTS', reportDate: '2026-11-24' } as never),
    method: 'POST',
    url: 'api/letters/report',
    body: { type: 'LISTS' },
  },
  {
    name: 'внесене вручну',
    run: (s) => s.createExternalNotice({ employeeId: E, number: '7' } as never),
    method: 'POST',
    url: 'api/letters/external-notice',
    body: { number: '7' },
  },
  {
    name: 'редагування',
    run: (s) => s.update(L, { subject: 'Тема' } as never),
    method: 'PATCH',
    url: `api/letters/${L}`,
    body: { subject: 'Тема' },
  },
  {
    name: 'видалення',
    run: (s) => s.remove(L),
    method: 'DELETE',
    url: `api/letters/${L}`,
    response: null,
  },
  {
    name: 'надіслано поза системою',
    run: (s) => s.markSent(L),
    method: 'POST',
    url: `api/letters/${L}/mark-sent`,
  },
]);

httpContract('ReportsService', ReportsService, [
  { name: 'огляд', run: (s) => s.dashboard(), method: 'GET', url: 'api/reports/dashboard' },
  {
    name: 'списки юрособи',
    run: (s) => s.lists('2026-11-24', LE),
    method: 'GET',
    url: 'api/reports/lists',
    params: { date: '2026-11-24', entity: LE },
  },
  {
    name: 'відомість усіх юросіб',
    run: (s) => s.operational('2026-11-24'),
    method: 'GET',
    url: 'api/reports/operational',
    params: { date: '2026-11-24' },
  },
  {
    name: 'витяги',
    run: (s) => s.extracts('2026-11-24', LE),
    method: 'GET',
    url: 'api/reports/extracts',
    params: { entity: LE },
    response: [],
  },
]);

httpContract('SignaturesService', SignaturesService, [
  {
    name: 'стан підпису',
    run: (s) => s.state(L),
    method: 'GET',
    url: `api/letters/${L}/signatures`,
  },
  { name: 'зафіксувати', run: (s) => s.freeze(L), method: 'POST', url: `api/letters/${L}/freeze` },
  {
    name: 'скасувати фіксацію',
    run: (s) => s.unfreeze(L),
    method: 'DELETE',
    url: `api/letters/${L}/freeze`,
  },
  {
    name: 'додати підпис',
    run: (s) => s.add(L, 'cDdz', 'WIDGET' as never),
    method: 'POST',
    url: `api/letters/${L}/signatures`,
    body: { signature: 'cDdz', method: 'WIDGET' },
  },
]);

httpContract('ListsService', ListsService, [
  {
    name: 'сформовані списки',
    run: (s) => s.snapshots(LE),
    method: 'GET',
    url: 'api/reports/lists/snapshots',
    params: { entity: LE },
    response: [],
  },
  {
    name: 'один знімок',
    run: (s) => s.snapshot('s1'),
    method: 'GET',
    url: 'api/reports/lists/snapshots/s1',
  },
  {
    name: 'сформувати',
    run: (s) => s.form('2026-11-24', LE),
    method: 'POST',
    url: 'api/reports/lists/snapshots',
    body: { date: '2026-11-24', legalEntityId: LE },
  },
  {
    name: 'видалити знімок',
    run: (s) => s.remove('s1'),
    method: 'DELETE',
    url: 'api/reports/lists/snapshots/s1',
    response: null,
  },
  {
    name: 'налаштування списків',
    run: (s) => s.settings(LE),
    method: 'GET',
    url: `api/legal-entities/${LE}/list-settings`,
  },
  {
    name: 'зберегти розділ',
    run: (s) => s.save(LE, 'SOLDIERS' as never, { title: 'x' } as never),
    method: 'PUT',
    url: `api/legal-entities/${LE}/list-settings/SOLDIERS`,
  },
  {
    name: 'свій шаблон Word',
    run: (s) => s.uploadTemplate(LE, 'SOLDIERS' as never, new File(['x'], 'шаблон.docx')),
    method: 'POST',
    url: `api/legal-entities/${LE}/list-settings/SOLDIERS/template`,
    body: ['file'],
  },
  {
    name: 'прибрати шаблон',
    run: (s) => s.removeTemplate(LE, 'SOLDIERS' as never),
    method: 'DELETE',
    url: `api/legal-entities/${LE}/list-settings/SOLDIERS/template`,
  },
]);

httpContract('HrSyncService', HrSyncService, [
  {
    name: 'налаштування',
    run: (s) => s.get(LE),
    method: 'GET',
    url: `api/legal-entities/${LE}/hr-sync`,
  },
  {
    name: 'історія',
    run: (s) => s.history(LE),
    method: 'GET',
    url: `api/legal-entities/${LE}/hr-sync/batches`,
    response: [],
  },
  {
    name: 'зберегти',
    run: (s) => s.save(LE, { mode: 'PUSH' } as never),
    method: 'PUT',
    url: `api/legal-entities/${LE}/hr-sync`,
    body: { mode: 'PUSH' },
  },
  {
    name: 'вимкнути',
    run: (s) => s.remove(LE),
    method: 'DELETE',
    url: `api/legal-entities/${LE}/hr-sync`,
    response: null,
  },
  {
    name: 'отримати ще раз',
    run: (s) => s.reopen(LE),
    method: 'POST',
    url: `api/legal-entities/${LE}/hr-sync/reopen`,
  },
  {
    name: 'новий ключ',
    run: (s) => s.issueToken(LE, 365),
    method: 'POST',
    url: `api/legal-entities/${LE}/hr-sync/token`,
    body: { validDays: 365 },
  },
  {
    name: 'відкликати ключ',
    run: (s) => s.revokeToken(LE),
    method: 'DELETE',
    url: `api/legal-entities/${LE}/hr-sync/token`,
  },
  {
    name: 'перевірити з’єднання',
    run: (s) => s.check(LE),
    method: 'POST',
    url: `api/legal-entities/${LE}/hr-sync/check`,
  },
  {
    name: 'отримати зараз',
    run: (s) => s.pull(LE),
    method: 'POST',
    url: `api/legal-entities/${LE}/hr-sync/pull`,
  },
  {
    name: 'отримання',
    run: (s) => s.batch(LE, 'b1'),
    method: 'GET',
    url: `api/legal-entities/${LE}/hr-sync/batches/b1`,
  },
  {
    name: 'застосувати',
    run: (s) => s.apply(LE, 'b1'),
    method: 'POST',
    url: `api/legal-entities/${LE}/hr-sync/batches/b1/apply`,
  },
  {
    name: 'відхилити',
    run: (s) => s.discard(LE, 'b1'),
    method: 'POST',
    url: `api/legal-entities/${LE}/hr-sync/batches/b1/discard`,
  },
]);

httpContract('UsersService', UsersService, [
  { name: 'список', run: (s) => s.list(), method: 'GET', url: 'api/users', response: [] },
  {
    name: 'новий обліковий запис — модулі передано',
    run: (s) =>
      s.create({
        email: 'new@example.com',
        fullName: 'Нова',
        role: 'HR',
        modules: ['oblik'],
      } as never),
    method: 'POST',
    url: 'api/users',
    body: { modules: ['oblik'] },
  },
  {
    name: 'зміна',
    run: (s) => s.update('u1', { isActive: false } as never),
    method: 'PATCH',
    url: 'api/users/u1',
    body: { isActive: false },
  },
  {
    name: 'попросити змінити пароль',
    run: (s) => s.requestPasswordChange('u1'),
    method: 'POST',
    url: 'api/users/u1/password-change-request',
  },
  {
    name: 'скинути пароль',
    run: (s) => s.resetPassword('u1'),
    method: 'POST',
    url: 'api/users/u1/reset-password',
  },
  {
    name: 'скинути вхід з кодом',
    run: (s) => s.resetMfa('u1'),
    method: 'POST',
    url: 'api/users/u1/mfa/reset',
  },
  { name: 'розблокувати', run: (s) => s.unlock('u1'), method: 'POST', url: 'api/users/u1/unlock' },
]);

httpContract('TwoFactorService', TwoFactorService, [
  { name: 'стан', run: (s) => s.status(), method: 'GET', url: 'api/auth/mfa' },
  {
    name: 'новий секрет — з паролем',
    run: (s) => s.setup('pass'),
    method: 'POST',
    url: 'api/auth/mfa/setup',
    body: { password: 'pass' },
  },
  {
    name: 'увімкнути',
    run: (s) => s.enable('123456'),
    method: 'POST',
    url: 'api/auth/mfa/enable',
    body: { code: '123456' },
  },
  {
    name: 'вимкнути',
    run: (s) => s.disable('pass', '123456'),
    method: 'POST',
    url: 'api/auth/mfa/disable',
    body: { password: 'pass', code: '123456' },
  },
  {
    name: 'нові резервні коди',
    run: (s) => s.renewCodes('pass', '123456'),
    method: 'POST',
    url: 'api/auth/mfa/recovery-codes',
  },
]);

httpContract('SecurityService', SecurityService, [
  {
    name: 'журнал подій',
    run: (s) => s.events({ kind: 'NEW_DEVICE', page: 2, size: 20 }),
    method: 'GET',
    url: 'api/security/events',
    params: { kind: 'NEW_DEVICE', page: '2', size: '20' },
  },
  {
    name: 'хто завантажив файл — лише SHA-256',
    run: (s) => s.trace('ab'.repeat(32)),
    method: 'POST',
    url: 'api/security/trace',
    body: { sha256: 'ab'.repeat(32) },
    response: [],
  },
]);

httpContract('BillingService', BillingService, [
  { name: 'стан оплати', run: (s) => s.status(), method: 'GET', url: 'api/billing/status' },
  { name: 'запис', run: (s) => s.record(), method: 'GET', url: 'api/billing' },
  {
    name: 'зміна',
    run: (s) => s.update({ debt: true } as never),
    method: 'PUT',
    url: 'api/billing',
    body: { debt: true },
  },
]);

httpContract('VendorBillingService', VendorBillingService, [
  { name: 'налаштування', run: (s) => s.settings(), method: 'GET', url: 'api/billing/settings' },
  {
    name: 'зберегти',
    run: (s) => s.saveSettings({ monthlyPrice: 500 } as never),
    method: 'PUT',
    url: 'api/billing/settings',
    body: { monthlyPrice: 500 },
  },
  {
    name: 'підписки',
    run: (s) => s.subscriptions(),
    method: 'GET',
    url: 'api/billing/subscriptions',
    response: [],
  },
  {
    name: 'рахунки',
    run: (s) => s.invoices(),
    method: 'GET',
    url: 'api/billing/invoices',
    response: [],
  },
  {
    name: 'продовжити пробний',
    run: (s) => s.extendTrial('s1', '2026-12-31'),
    method: 'POST',
    url: 'api/billing/subscriptions/s1/trial',
    body: { until: '2026-12-31' },
  },
  {
    name: 'рахунок вручну',
    run: (s) => s.issueInvoice('s1', { months: 6, total: 100 } as never),
    method: 'POST',
    url: 'api/billing/subscriptions/s1/invoices',
  },
  {
    name: 'оплачено',
    run: (s) => s.markPaid('i1', '2026-11-24'),
    method: 'POST',
    url: 'api/billing/invoices/i1/paid',
    body: { paidAt: '2026-11-24' },
  },
  {
    name: 'скасувати',
    run: (s) => s.cancel('i1'),
    method: 'POST',
    url: 'api/billing/invoices/i1/cancel',
  },
]);

httpContract('EntityDatabaseService', EntityDatabaseService, [
  {
    name: 'своя база',
    run: (s) => s.get(LE),
    method: 'GET',
    url: `api/legal-entities/${LE}/database`,
  },
  {
    name: 'зберегти',
    run: (s) => s.save(LE, { host: 'db.example.com' } as never),
    method: 'PUT',
    url: `api/legal-entities/${LE}/database`,
  },
  {
    name: 'перевірити',
    run: (s) => s.check(LE),
    method: 'POST',
    url: `api/legal-entities/${LE}/database/check`,
  },
  {
    name: 'вимкнути',
    run: (s) => s.remove(LE),
    method: 'DELETE',
    url: `api/legal-entities/${LE}/database`,
    response: null,
  },
]);

httpContract('EmployeeImportService', EmployeeImportService, [
  {
    name: 'файл на перевірку',
    run: (s) => s.preview(new File(['x'], 'працівники.xlsx')),
    method: 'POST',
    url: 'api/employees/import/preview',
    body: ['file'],
  },
  {
    name: 'перевірити правки',
    run: (s) => s.check([{ rowNumber: 2, values: { lastName: 'Вигаданий' }, issues: [] } as never]),
    method: 'POST',
    url: 'api/employees/import/check',
    response: [],
  },
  {
    name: 'імпортувати — без порожньої юрособи',
    run: (s) =>
      s.commit([{ rowNumber: 2, values: { lastName: 'Вигаданий' }, issues: [] } as never], {
        legalEntityId: '',
        hireNotices: 'RECENT',
      } as never),
    method: 'POST',
    url: 'api/employees/import/commit',
    body: { hireNotices: 'RECENT' },
  },
]);

describe('URL файлів (без запитів)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('листи: документ, опис ф107, пакет для пошти, звірка, наклейки, друк', () => {
    const s = TestBed.inject(LettersService);
    expect(s.documentUrl(L)).toBe(`api/letters/${L}/docx`);
    expect(s.inventoryUrl(L)).toBe(`api/letters/${L}/inventory`);
    expect(s.postPackageUrl(L)).toBe(`api/letters/${L}/post-package`);
    expect(s.reconciliationUrl(L)).toBe(`api/letters/${L}/reconciliation?part=all`);
    expect(s.reconciliationUrl(L, 'cover')).toBe(`api/letters/${L}/reconciliation?part=cover`);
    expect(s.noticeDocxUrl('n1')).toBe('api/change-notices/n1/docx');
    expect(s.labelsUrl([L, 'l2'])).toBe(`api/letters/labels?ids=${L},l2`);
    expect(s.labelsPrintUrl([L])).toBe(`/print/labels?ids=${L}`);
  });

  it('звіти: списки чи витяг .docx з параметрами; відомість', () => {
    const s = TestBed.inject(ReportsService);
    expect(s.listsDocxUrl()).toBe('api/reports/lists/docx');
    expect(
      s.listsDocxUrl({
        date: '2026-11-24',
        ids: ['a', 'b'],
        tck: 't1',
        groups: ['G1'] as never,
        entity: LE,
      }),
    ).toBe(`api/reports/lists/docx?date=2026-11-24&ids=a%2Cb&tck=t1&groups=G1&entity=${LE}`);
    expect(s.operationalDocxUrl('2026-11-24')).toBe('api/reports/operational/docx?date=2026-11-24');
    expect(s.operationalDocxUrl('2026-11-24', LE)).toBe(
      `api/reports/operational/docx?date=2026-11-24&entity=${LE}`,
    );
  });

  it('підписи, списки, рахунки', () => {
    const sig = TestBed.inject(SignaturesService);
    expect(sig.signingFileUrl(L)).toBe(`api/letters/${L}/signing-file`);
    expect(sig.signatureFileUrl(L, 's1')).toBe(`api/letters/${L}/signatures/s1/file`);
    expect(sig.packageUrl(L)).toBe(`api/letters/${L}/signed-package`);
    const lists = TestBed.inject(ListsService);
    expect(lists.snapshotDocxUrl('s1')).toBe('api/reports/lists/snapshots/s1/docx');
    expect(lists.snapshotDocxUrl('s1', 'WOMEN' as never)).toBe(
      'api/reports/lists/snapshots/s1/docx?section=WOMEN',
    );
    expect(lists.templateUrl(LE, 'WOMEN' as never)).toBe(
      `api/legal-entities/${LE}/list-settings/WOMEN/template`,
    );
    expect(lists.exampleUrl(LE, 'WOMEN' as never)).toBe(
      `api/legal-entities/${LE}/list-settings/WOMEN/example`,
    );
    expect(TestBed.inject(VendorBillingService).invoiceUrl('i1')).toBe(
      'api/subscription/invoices/i1/docx',
    );
    expect(TestBed.inject(EmployeeImportService).templateUrl).toBe('api/employees/import/template');
  });
});

httpContract('LegalEntitiesService', LegalEntitiesService, [
  { name: 'перелік', run: (s) => s.list(), method: 'GET', url: 'api/legal-entities', response: [] },
  { name: 'одна', run: (s) => s.get('le1'), method: 'GET', url: 'api/legal-entities/le1' },
  {
    name: 'створити',
    run: (s) => s.create({ fullName: 'ТОВ «Вигадана»' } as never),
    method: 'POST',
    url: 'api/legal-entities',
    body: { fullName: 'ТОВ «Вигадана»' },
  },
  {
    name: 'змінити',
    run: (s) => s.update('le1', { fullName: 'Інша' } as never),
    method: 'PATCH',
    url: 'api/legal-entities/le1',
  },
  {
    name: 'видалити',
    run: (s) => s.remove('le1'),
    method: 'DELETE',
    url: 'api/legal-entities/le1',
  },
  {
    name: 'люди',
    run: (s) => s.people('le1'),
    method: 'GET',
    url: 'api/legal-entities/le1/people',
  },
  {
    name: 'видати доступ керівнику',
    run: (s) =>
      s.grantAccess('le1', 'HEAD', { email: 'head@example.com', role: 'DIRECTOR' } as never),
    method: 'POST',
    url: 'api/legal-entities/le1/people/head/access',
    body: { email: 'head@example.com' },
  },
  {
    name: 'скасувати доступ відповідального',
    run: (s) => s.revokeAccess('le1', 'RESPONSIBLE'),
    method: 'DELETE',
    url: 'api/legal-entities/le1/people/responsible/access',
  },
  {
    name: 'нова людина',
    run: (s) => s.changePerson('le1', 'HEAD', { fullName: 'Вигаданий' } as never),
    method: 'PUT',
    url: 'api/legal-entities/le1/people/head',
  },
  {
    name: 'наклейки',
    run: (s) => s.labelSettings('le1'),
    method: 'GET',
    url: 'api/legal-entities/le1/label-settings',
  },
  {
    name: 'зберегти наклейки',
    run: (s) => s.saveLabelSettings('le1', {} as never),
    method: 'PUT',
    url: 'api/legal-entities/le1/label-settings',
  },
  { name: 'квота', run: (s) => s.quota('le1'), method: 'GET', url: 'api/legal-entities/le1/quota' },
  {
    name: 'листи про квоту',
    run: (s) => s.saveQuotaNotify('le1', { enabled: true } as never),
    method: 'PUT',
    url: 'api/legal-entities/le1/quota-notify',
    body: { enabled: true },
  },
  {
    name: 'бланк',
    run: (s) => s.letterhead('le1'),
    method: 'GET',
    url: 'api/legal-entities/le1/letterhead',
  },
  {
    name: 'зберегти бланк',
    run: (s) => s.saveLetterhead('le1', {} as never),
    method: 'PUT',
    url: 'api/legal-entities/le1/letterhead',
  },
  {
    name: 'ЄДР за кодом',
    run: (s) => s.lookup('12345678'),
    method: 'GET',
    url: 'api/legal-entities/lookup',
    params: { edrpou: '12345678' },
  },
]);

httpContract('AccountService', AccountService, [
  {
    name: 'реєстрація увімкнена?',
    run: (s) => s.registerInfo(),
    method: 'GET',
    url: 'api/auth/register',
  },
  {
    name: 'заява',
    run: (s) => s.signupStatement({ edrpou: '12345678' } as never),
    method: 'POST',
    url: 'api/auth/register/statement',
    body: { edrpou: '12345678' },
  },
  {
    name: 'підпис заяви',
    run: (s) => s.signupSign('r1', 'MIIB'),
    method: 'POST',
    url: 'api/auth/register/r1/sign',
    body: { signature: 'MIIB' },
  },
  { name: 'заявки', run: (s) => s.signups(), method: 'GET', url: 'api/signups', response: [] },
  { name: 'оферта', run: (s) => s.terms(), method: 'GET', url: 'api/terms' },
  { name: 'стан оферти', run: (s) => s.offerStatus(), method: 'GET', url: 'api/terms/status' },
  {
    name: 'документ акцепту',
    run: (s) => s.offerDocument(),
    method: 'POST',
    url: 'api/terms/document',
  },
  {
    name: 'підпис акцепту',
    run: (s) => s.signOffer('d1', 'MIIB'),
    method: 'POST',
    url: 'api/terms/document/d1/sign',
    body: { signature: 'MIIB' },
  },
  { name: 'підписка', run: (s) => s.subscription(), method: 'GET', url: 'api/subscription' },
  {
    name: 'тариф',
    run: (s) => s.choosePlan('BASIC' as never, 'примітка'),
    method: 'POST',
    url: 'api/subscription/plan',
    body: { plan: 'BASIC', note: 'примітка' },
    response: { required: true },
  },
  { name: 'рахунок', run: (s) => s.renew(), method: 'POST', url: 'api/subscription/invoices' },
]);

describe('AccountService — стан підписки для guards', () => {
  it('кешує на хвилину; force і forget читають заново', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(AccountService);
    const backend = TestBed.inject(HttpTestingController);
    const first = service.subscriptionState();
    backend.expectOne('api/subscription').flush({ required: true });
    expect(await first).toEqual({ required: true });
    expect(service.billingRequired()).toBe(true);
    expect(await service.subscriptionState()).toEqual({ required: true });
    const forced = service.subscriptionState(true);
    backend.expectOne('api/subscription').flush({ required: false });
    expect(await forced).toEqual({ required: false });
    service.forget();
    const again = service.subscriptionState();
    backend.expectOne('api/subscription').flush({ required: false });
    await again;
    expect(service.invoiceUrl('i1')).toBe('api/subscription/invoices/i1/docx');
    backend.verify();
  });
});
