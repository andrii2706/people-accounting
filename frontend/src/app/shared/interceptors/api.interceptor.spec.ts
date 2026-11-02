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

  beforeEach(() => {
    navigate.mockClear();
    markSignedOut.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Router, useValue: { navigate, url: '/employees' } },
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

  it('інші помилки лише передає далі', async () => {
    await fail('/api/employees', 500);
    expect(navigate).not.toHaveBeenCalled();
    expect(markSignedOut).not.toHaveBeenCalled();
  });
});
