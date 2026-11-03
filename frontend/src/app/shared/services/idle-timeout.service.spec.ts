import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from '../constants/auth.constants';
import { IdleTimeoutService } from './idle-timeout.service';

describe('IdleTimeoutService', () => {
  let logout: ReturnType<typeof vi.fn>;
  let idle: IdleTimeoutService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
    logout = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: { logout } },
      ],
    });
    idle = TestBed.inject(IdleTimeoutService);
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/employees/42');
    idle.start();
  });

  afterEach(() => {
    idle.stop();
    vi.useRealTimers();
  });

  it('за хвилину до виходу показує відлік, після 10 хв бездіяльності виходить', () => {
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000);
    expect(idle.secondsLeft()).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(idle.secondsLeft()).toBeGreaterThan(0);
    vi.advanceTimersByTime(IDLE_WARNING_MS);
    expect(logout).toHaveBeenCalledWith({ reason: 'idle', returnUrl: '/employees/42' });
  });

  it('рух мишки чи клавіша скидає таймер', () => {
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 5000);
    expect(idle.secondsLeft()).not.toBeNull();
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(idle.secondsLeft()).toBeNull();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 5000);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 5000);
    expect(logout).not.toHaveBeenCalled();
  });

  it('активність в іншій вкладці теж рахується', () => {
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 5000);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'mr.lastActivity', newValue: String(Date.now()) }),
    );
    vi.advanceTimersByTime(10_000);
    expect(logout).not.toHaveBeenCalled();
  });
});
