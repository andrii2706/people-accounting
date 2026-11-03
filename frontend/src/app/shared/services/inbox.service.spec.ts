import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { InboxItem } from '../interfaces/inbox.interface';
import { InboxService } from './inbox.service';

const item = (key: string, read = false): InboxItem => ({
  key,
  kind: 'DEADLINE',
  level: 'warning',
  employeeId: 'e1',
  employeeName: 'Приклад Петро',
  message: 'Відстрочка закінчується…',
  link: 'EMPLOYEE',
  read,
});

describe('InboxService', () => {
  let service: InboxService;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InboxService);
    backend = TestBed.inject(HttpTestingController);
    const loaded = service.load();
    backend
      .expectOne('/api/inbox')
      .flush({ items: [item('a'), item('b'), item('c', true)], unread: 2 });
    await loaded;
  });

  afterEach(() => backend.verify());

  it('рахує непрочитані', () => {
    expect(service.loaded()).toBe(true);
    expect(service.unreadCount()).toBe(2);
  });

  it('«прочитано» одразу в інтерфейсі, на сервер — лише непрочитані ключі', async () => {
    const done = service.markRead(['a', 'c']);
    expect(service.unreadCount()).toBe(1);
    const req = backend.expectOne('/api/inbox/read');
    expect(req.request.body).toEqual({ keys: ['a'] });
    req.flush(null);
    await done;
  });

  it('прочитати все', async () => {
    const done = service.markAllRead();
    expect(service.unreadCount()).toBe(0);
    backend.expectOne({ method: 'POST', url: '/api/inbox/read-all' }).flush(null);
    await done;
  });
});
