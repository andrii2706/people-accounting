import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  convertToParamMap,
  provideRouter,
  RedirectCommand,
  type ActivatedRouteSnapshot,
  type ResolveFn,
} from '@angular/router';
import { firstValueFrom, isObservable, of, throwError, type Observable } from 'rxjs';
import { AccountService } from '../../../shared/services/account.service';
import { EntityDatabaseService } from '../../../shared/services/entity-database.service';
import { HrSyncService } from '../../../shared/services/hr-sync.service';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ListsService } from '../../../shared/services/lists.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UsersService } from '../../../shared/services/users.service';
import { toastStub } from '../../../testing/fixtures.testing';
import {
  extractsResolver,
  listsPageResolver,
  operationalReportResolver,
} from '../../reports/resolvers/report.resolvers';
import {
  entityDatabaseResolver,
  hrSyncResolver,
  labelSettingsResolver,
  letterheadResolver,
  listSettingsResolver,
  organizationSettingsResolver,
  quotaResolver,
  signupsResolver,
  usersResolver,
} from './settings.resolvers';

const ENTITY = {
  id: 'le1',
  shortName: '',
  fullName: 'ТОВ «Вигадана компанія»',
  edrpou: '12345678',
};
const SNAP = (id: string) => ({
  id,
  legalEntityId: 'le1',
  date: '2026-11-01',
  total: 0,
  sections: {},
  createdAt: '',
  createdByName: '',
});

/** Every method of a service answers its own name — enough to see what the resolver combined. */
const answering = (over: Record<string, unknown> = {}) =>
  new Proxy(over, { get: (t, k: string) => (k in t ? t[k] : () => of({ from: k })) });

function setup(over: Record<string, Record<string, unknown>> = {}) {
  const toast = toastStub();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ToastService, useValue: toast },
      {
        provide: LegalEntitiesService,
        useValue: answering({ get: () => of(ENTITY), ...over['entities'] }),
      },
      { provide: OrganizationService, useValue: answering(over['organization']) },
      { provide: AccountService, useValue: answering(over['account']) },
      { provide: UsersService, useValue: answering(over['users']) },
      { provide: EntityDatabaseService, useValue: answering(over['db']) },
      { provide: HrSyncService, useValue: answering(over['sync']) },
      { provide: ListsService, useValue: answering(over['lists']) },
      { provide: ReportsService, useValue: answering(over['reports']) },
    ],
  });
  return { toast };
}

const route = (params: Record<string, string> = {}, query: Record<string, string> = {}) =>
  ({
    paramMap: convertToParamMap(params),
    queryParamMap: convertToParamMap(query),
  }) as unknown as ActivatedRouteSnapshot;

async function resolve<T>(fn: ResolveFn<T>, r = route({ id: 'le1' })) {
  const out = runInInjectionContext(TestBed.inject(EnvironmentInjector), () => fn(r, {} as never));
  return (isObservable(out) ? await firstValueFrom(out as Observable<unknown>) : out) as Record<
    string,
    unknown
  >;
}

describe('resolvers налаштувань — дані сторінки та назва юрособи', () => {
  it('сторінки юрособи: дані + entityId і назва', async () => {
    setup();
    for (const fn of [
      labelSettingsResolver,
      letterheadResolver,
      listSettingsResolver,
      quotaResolver,
    ]) {
      expect(await resolve(fn as ResolveFn<unknown>)).toMatchObject({
        entityId: 'le1',
        entityName: 'ТОВ «Вигадана компанія»',
      });
    }
    expect(await resolve(entityDatabaseResolver as ResolveFn<unknown>)).toMatchObject({
      db: { from: 'get' },
      entityId: 'le1',
    });
    expect(await resolve(hrSyncResolver as ResolveFn<unknown>)).toMatchObject({
      settings: { from: 'get' },
      history: { from: 'history' },
      edrpou: '12345678',
    });
    expect(await resolve(organizationSettingsResolver as ResolveFn<unknown>)).toMatchObject({
      organization: { from: 'organization' },
      status: { from: 'notificationStatus' },
    });
    expect(await resolve(signupsResolver as ResolveFn<unknown>)).toEqual({ from: 'signups' });
    expect(await resolve(usersResolver as ResolveFn<unknown>)).toEqual({ from: 'list' });
  });

  it('помилка завантаження — повідомлення і перехід назад', async () => {
    const { toast } = setup({ entities: { get: () => throwError(() => new Error('x')) } });
    expect(await resolve(quotaResolver as ResolveFn<unknown>)).toBeInstanceOf(RedirectCommand);
    expect(toast.error).toHaveBeenCalledWith('Не вдалося завантажити дані');
  });
});

describe('resolvers звітів', () => {
  it('списки: обраний знімок, інакше останній; нічого — без звіту; знімок не прочитано — null', async () => {
    const snapshot = vi.fn((id: string) =>
      id === 'bad' ? throwError(() => new Error('x')) : of({ id }),
    );
    setup({ lists: { snapshots: () => of([SNAP('s2'), SNAP('s1'), SNAP('bad')]), snapshot } });
    expect(
      await resolve(listsPageResolver as ResolveFn<unknown>, route({}, { snapshot: 's1' })),
    ).toMatchObject({ report: { id: 's1' } });
    expect(
      await resolve(listsPageResolver as ResolveFn<unknown>, route({}, { snapshot: 'нема' })),
    ).toMatchObject({ report: { id: 's2' } });
    expect(
      await resolve(listsPageResolver as ResolveFn<unknown>, route({}, { snapshot: 'bad' })),
    ).toMatchObject({ report: null });
    TestBed.resetTestingModule();
    setup({ lists: { snapshots: () => of([]) } });
    expect(await resolve(listsPageResolver as ResolveFn<unknown>)).toEqual({
      snapshots: [],
      report: null,
    });
  });

  it('оперативний звіт і витяги — за датою й юрособою з адреси', async () => {
    const operational = vi.fn(() => of({ rows: [] }));
    const extracts = vi.fn(() => of([]));
    setup({ reports: { operational, extracts } });
    await resolve(
      operationalReportResolver as ResolveFn<unknown>,
      route({}, { date: '2026-11-01', entity: 'le1' }),
    );
    expect(operational).toHaveBeenCalledWith('2026-11-01', 'le1');
    await resolve(extractsResolver as ResolveFn<unknown>, route());
    expect(extracts).toHaveBeenCalledWith(expect.any(String), '');
  });
});
