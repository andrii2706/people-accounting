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

  it('налаштування читаються як Observable (для резолвера)', async () => {
    const org = firstValueFrom(service.organization());
    backend.expectOne('/api/organization').flush({ alertDays: 30, notifyDeadlineDays: 7 });
    await expect(org).resolves.toMatchObject({ alertDays: 30 });
  });
});
