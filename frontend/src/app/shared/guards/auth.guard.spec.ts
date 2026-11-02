import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import type { AuthUser } from '../interfaces/auth.interface';
import { AuthService } from '../services/auth.service';
import { adminGuard, authGuard, guestGuard, passwordChangeGuard } from './auth.guard';

const user = (patch: Partial<AuthUser> = {}) =>
  ({
    id: 'u1',
    email: 'hr@company.ua',
    fullName: 'Кадровик',
    role: 'HR',
    mustChangePassword: false,
    ...patch,
  }) as AuthUser;

function setup(current: AuthUser | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { ensureLoaded: () => Promise.resolve(current) } },
    ],
  });
  return TestBed.inject(Router);
}

const run = (guard: typeof authGuard, url = '/employees') =>
  TestBed.runInInjectionContext(() => guard({} as never, { url } as never)) as Promise<
    boolean | UrlTree
  >;

const urlOf = (result: boolean | UrlTree, router: Router) =>
  typeof result === 'boolean' ? result : router.serializeUrl(result);

describe('auth guards', () => {
  it('без входу веде на /login і запам’ятовує, куди йшли', async () => {
    const router = setup(null);
    expect(urlOf(await run(authGuard, '/employees/42'), router)).toBe(
      '/login?returnUrl=%2Femployees%2F42',
    );
  });

  it('пропускає користувача, який увійшов', async () => {
    setup(user());
    expect(await run(authGuard)).toBe(true);
  });

  it('налаштування — лише адміністратору', async () => {
    const router = setup(user());
    expect(urlOf(await run(adminGuard), router)).toBe('/');
    TestBed.resetTestingModule();
    setup(user({ role: 'ADMIN' }));
    expect(await run(adminGuard)).toBe(true);
  });

  it('сторінка входу — лише для тих, хто не увійшов', async () => {
    const router = setup(user());
    expect(urlOf(await run(guestGuard), router)).toBe('/');
  });

  it('з тимчасовим паролем пускає лише в профіль', async () => {
    const router = setup(user({ mustChangePassword: true }));
    expect(urlOf(await run(passwordChangeGuard, '/employees'), router)).toBe('/profile');
    expect(await run(passwordChangeGuard, '/profile')).toBe(true);
  });
});
