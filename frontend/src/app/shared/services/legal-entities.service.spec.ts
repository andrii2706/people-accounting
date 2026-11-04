import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EMPTY_LEGAL_ENTITY } from '../constants/legal-entity.constants';
import { legalEntityBody } from '../utils/legal-entity.utils';
import { DictionariesService } from './dictionaries.service';
import { LegalEntitiesService } from './legal-entities.service';

// fictitious company
describe('LegalEntitiesService', () => {
  let service: LegalEntitiesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LegalEntitiesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('пошук у ЄДР — GET з кодом', async () => {
    const done = service.lookup('12345678');
    const req = backend.expectOne((r) => r.url === '/api/legal-entities/lookup');
    expect(req.request.params.get('edrpou')).toBe('12345678');
    req.flush({ edrpou: '12345678', fullName: 'ТОВ «ПРИКЛАД»', headName: 'Іван ПРИКЛАДНИЙ' });
    await expect(done).resolves.toMatchObject({ headName: 'Іван ПРИКЛАДНИЙ' });
  });

  it('створення: порожня квота — null, рядки обрізані', async () => {
    const body = legalEntityBody({
      ...EMPTY_LEGAL_ENTITY,
      fullName: '  ТОВ «Приклад» ',
      edrpou: '12345678',
      phone: '+380670000000',
    });
    const done = service.create(body);
    const req = backend.expectOne({ method: 'POST', url: '/api/legal-entities' });
    expect(req.request.body).toMatchObject({
      fullName: 'ТОВ «Приклад»',
      reservationQuota: null,
      phone: '+380670000000',
    });
    req.flush({ id: 'e1', ...body });
    await expect(done).resolves.toMatchObject({ id: 'e1' });
  });

  it('доступ відповідальному: POST з email і роллю; скасування — DELETE', async () => {
    const granted = service.grantAccess('e1', 'RESPONSIBLE', {
      email: 'oblik@example.com',
      role: 'HR',
    });
    const req = backend.expectOne('/api/legal-entities/e1/people/responsible/access');
    expect(req.request.method).toBe('POST');
    req.flush({ access: { email: 'oblik@example.com' }, temporaryPassword: 'Tmp12345abcd' });
    await expect(granted).resolves.toMatchObject({ temporaryPassword: 'Tmp12345abcd' });

    const revoked = service.revokeAccess('e1', 'HEAD');
    backend
      .expectOne({ method: 'DELETE', url: '/api/legal-entities/e1/people/head/access' })
      .flush({ deactivated: true, email: 'boss@example.com' });
    await expect(revoked).resolves.toMatchObject({ deactivated: true });
  });

  it('імпорт ТЦК надсилає items і повертає підсумок', async () => {
    const dict = TestBed.inject(DictionariesService);
    const done = dict.importTck([{ name: 'Сихівський РТЦК та СП (м. Львів)' }]);
    const req = backend.expectOne('/api/tck/import');
    expect(req.request.body).toEqual({ items: [{ name: 'Сихівський РТЦК та СП (м. Львів)' }] });
    req.flush({ created: 1, updated: 0 });
    await expect(done).resolves.toEqual({ created: 1, updated: 0 });
  });
});
