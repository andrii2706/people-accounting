import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const navigate = vi.fn().mockResolvedValue(true);
  const markSignedOut = vi.fn();
  /** The navigation in progress: null — none; otherwise the URL it is heading to. */
  let heading: string | null = null;
  const router = {
    navigate,
    url: '/employees',
    currentNavigation: () => (heading ? { extractedUrl: heading, finalUrl: undefined } : null),
    serializeUrl: (url: string) => url,
  };

  beforeEach(() => {
    navigate.mockClear();
    markSignedOut.mockClear();
    heading = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { markSignedOut } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const fail = async (url: string, status: number, body: object | null = null) => {
    const request = firstValueFrom(http.get(url));
    backend.expectOne(url).flush(body, { status, statusText: 'x' });
    await expect(request).rejects.toBeTruthy();
  };

  it('після завершення сесії (401) виходить і веде на вхід з поверненням', async () => {
    await fail('/api/employees', 401);
    expect(markSignedOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/employees', expired: 1 },
    });
  });

  it('401 на самому вході — це невірний пароль, а не завершена сесія', async () => {
    await fail('/api/auth/login', 401);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('з тимчасовим паролем веде в профіль', async () => {
    await fail('/api/employees', 403, { code: 'PASSWORD_CHANGE_REQUIRED' });
    expect(navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('не перезапускає перехід, який уже йде в профіль (інакше — нескінченні запити резолверів)', async () => {
    heading = '/profile';
    await fail('/api/legal-entities', 403, { code: 'PASSWORD_CHANGE_REQUIRED' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('без обраного тарифу веде до тарифів, після завершення строку — до підписки', async () => {
    await fail('/api/employees', 403, { code: 'PLAN_REQUIRED' });
    expect(navigate).toHaveBeenCalledWith(['/account/plans']);
    await fail('/api/employees', 403, { code: 'SUBSCRIPTION_EXPIRED' });
    expect(navigate).toHaveBeenCalledWith(['/account/subscription']);
  });

  it('інші помилки лише передає далі', async () => {
    await fail('/api/employees', 500);
    expect(navigate).not.toHaveBeenCalled();
    expect(markSignedOut).not.toHaveBeenCalled();
  });
});
