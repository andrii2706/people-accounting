import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrganizationService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('зміна керівника: POST з датою, з якої він підписує', async () => {
    const head = {
      position: 'Директор',
      fullName: 'Петро НОВИЙ',
      orderNumber: '15-к',
      validFrom: '2026-11-01',
      validTo: null,
    };
    const done = service.createHead(head);
    const req = backend.expectOne('/api/organization/heads');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(head);
    req.flush({ id: 'h1', ...head });
    await expect(done).resolves.toMatchObject({ id: 'h1' });
  });

  it('імпорт ТЦК надсилає items і повертає підсумок', async () => {
    const done = service.importTck([{ name: 'Сихівський РТЦК та СП (м. Львів)' }]);
    const req = backend.expectOne('/api/tck/import');
    expect(req.request.body).toEqual({ items: [{ name: 'Сихівський РТЦК та СП (м. Львів)' }] });
    req.flush({ created: 1, updated: 0 });
    await expect(done).resolves.toEqual({ created: 1, updated: 0 });
  });

  it('перевірка указів і тестовий лист — POST без тіла', async () => {
    const decrees = service.checkDecrees();
    backend
      .expectOne({ method: 'POST', url: '/api/notifications/check-decrees' })
      .flush({ ok: true, changed: false });
    await expect(decrees).resolves.toMatchObject({ ok: true });

    const mail = service.testMail();
    backend.expectOne({ method: 'POST', url: '/api/notifications/test' }).flush({ sent: true });
    await expect(mail).resolves.toEqual({ sent: true });
  });

  it('реквізити читаються як Observable (для резолвера)', async () => {
    const org = firstValueFrom(service.organization());
    backend.expectOne('/api/organization').flush({ fullName: 'ТзОВ «Приклад»' });
    await expect(org).resolves.toMatchObject({ fullName: 'ТзОВ «Приклад»' });
  });
});
