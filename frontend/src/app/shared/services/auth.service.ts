import { ENTITY_MANAGER_ROLES, PORTAL_HOME, ROLE_LABELS } from '../constants/auth.constants';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { uiIdlePortalUrl } from '@mr/ui';
import type {
  AuthUser,
  LogoutOptions,
  PasswordLinkInfo,
  SessionResponse,
} from '../interfaces/auth.interface';
import {
  AUTH_PATHS,
  isLoginChallenge,
  type LoginChallenge,
  type TwoFactorEnabled,
  type TwoFactorSetup,
} from '../../../platform/contracts/session';

/** Authentication state on signals. The session lives in an httpOnly cookie — JavaScript cannot see it. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _checked = signal(false);
  private pending: Promise<AuthUser | null> | null = null;
  /** Set by a sign-in with the password; the shell shows the new notifications once and clears it. */
  readonly justSignedIn = signal(false);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  /** The main administrator: all legal entities, system settings. */
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly isDirector = computed(() => this._user()?.role === 'DIRECTOR');
  /** Runs a legal entity: its card, the access of its people, its accounts. */
  readonly isEntityManager = computed(() =>
    ENTITY_MANAGER_ROLES.includes(this._user()?.role ?? 'HR'),
  );
  /** Every staff role works with the registration data of its legal entity. */
  readonly canEdit = computed(() => {
    const role = this._user()?.role;
    return !!role && role !== 'VENDOR';
  });
  /** Not bound to a legal entity yet: the director adds his, the others wait for the main administrator. */
  readonly needsEntity = computed(() => {
    const u = this._user();
    return !!u && u.role !== 'ADMIN' && u.role !== 'VENDOR' && !u.legalEntityId;
  });
  /** A new legal entity: the main administrator, or the director while he has none. */
  readonly canAddEntity = computed(
    () => this.isAdmin() || (this.isDirector() && this.needsEntity()),
  );
  readonly roleLabel = computed(() => ROLE_LABELS[this._user()?.role ?? 'HR']);
  readonly mustChangePassword = computed(() => !!this._user()?.mustChangePassword);
  /** The agreement still has to be accepted (after the password change). */
  readonly needsTerms = computed(() => {
    const u = this._user();
    return !!u && !u.mustChangePassword && u.termsAccepted === false;
  });
  /** The temporary password is changed and the agreement accepted — the work data may be requested. */
  readonly onboarded = computed(() => !this.mustChangePassword() && !this.needsTerms());
  readonly initials = computed(() =>
    (this._user()?.fullName ?? '')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  );

  /** One /auth/session request per app (and per SSR render; the result reaches the browser via TransferState). */
  ensureLoaded(): Promise<AuthUser | null> {
    if (this._checked()) return Promise.resolve(this._user());
    this.pending ??= firstValueFrom(this.http.get<SessionResponse>('api/auth/session'))
      .then(({ user }) => {
        this._user.set(user);
        return user;
      })
      .catch(() => {
        this._user.set(null);
        return null;
      })
      .finally(() => {
        this._checked.set(true);
        this.pending = null;
      });
    return this.pending;
  }

  /** Reads the session again (e.g. the director has just added his legal entity). */
  async refresh(): Promise<AuthUser | null> {
    const { user } = await firstValueFrom(this.http.get<SessionResponse>('api/auth/session'));
    this._user.set(user);
    return user;
  }

  /**
   * The password. With the code from the app on (or required for the role) the answer is a ticket for the
   * second step instead of the session.
   */
  async login(email: string, password: string): Promise<AuthUser | LoginChallenge> {
    const answer = await firstValueFrom(
      this.http.post<AuthUser | LoginChallenge>('api/auth/login', { email, password }),
    );
    if (isLoginChallenge(answer)) return answer;
    return this.signedIn(answer);
  }

  /** The second step: the code from the app or a recovery code. */
  async loginCode(ticket: string, code: string): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.post<AuthUser>(apiPath(AUTH_PATHS.loginCode), { ticket, code }),
    );
    return this.signedIn(user);
  }

  /** The first sign-in of a role that needs the code: a secret (QR) for the app. */
  loginSetup(ticket: string) {
    return firstValueFrom(
      this.http.post<TwoFactorSetup>(apiPath(AUTH_PATHS.loginSetup), { ticket }),
    );
  }

  /** …and the first code: the code is on, the session is issued, the recovery codes come once. */
  async loginEnable(ticket: string, code: string): Promise<TwoFactorEnabled<AuthUser>> {
    const result = await firstValueFrom(
      this.http.post<TwoFactorEnabled<AuthUser>>(apiPath(AUTH_PATHS.loginEnable), { ticket, code }),
    );
    // the session cookie is set; the user is shown only after the codes are saved (see the login page)
    this.pendingUser = result.user;
    return result;
  }

  /** The recovery codes are saved — the session that is already set becomes the current user. */
  finishSetup(): AuthUser | null {
    const user = this.pendingUser;
    this.pendingUser = null;
    return user ? this.signedIn(user) : null;
  }

  private pendingUser: AuthUser | null = null;

  private signedIn(user: AuthUser): AuthUser {
    this._user.set(user);
    this._checked.set(true);
    this.justSignedIn.set(true);
    return user;
  }

  /** Change own password. Other sessions of the user are terminated on the server. */
  async changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.post<AuthUser>('api/auth/change-password', { currentPassword, newPassword }),
    );
    this._user.set(user);
    return user;
  }

  /** Who the link «set a new password» from a letter is for (400 — invalid / used / expired). */
  passwordLink(token: string) {
    return firstValueFrom(
      this.http.get<PasswordLinkInfo>(`api/auth/password-reset/${encodeURIComponent(token)}`),
    );
  }

  /** A new password by the link from a letter; the server ends every session of the user. */
  async resetPassword(token: string, newPassword: string) {
    const result = await firstValueFrom(
      this.http.post<{ email: string }>('api/auth/password-reset', { token, newPassword }),
    );
    this._user.set(null);
    return result;
  }

  /** The server answered with the updated user (e.g. the agreement accepted). */
  setUser(user: AuthUser) {
    // other answers carry no address («п. Галино») — the one from the session stays
    const previous = this._user();
    this._user.set({ address: previous?.id === user.id ? previous.address : undefined, ...user });
  }

  /** The session ended on the server (idle timeout) — reset the state without a request. */
  /** Why the module was closed (the text of the API) — the login page shows it after ?reason=billing. */
  readonly closedMessage = signal('');

  markSignedOut() {
    this._user.set(null);
  }

  /**
   * 10 minutes without activity. Behind the portal (/oblik/) — back to the portal, not to a sign-in: it tells why
   * and, after a new sign-in if its session is over too, returns to this very page. Alone on a domain — the sign-in
   * of the module with the same explanation.
   */
  async idleLogout(): Promise<void> {
    await firstValueFrom(this.http.post<void>('api/auth/logout', {})).catch(() => undefined);
    this._user.set(null);
    const location = this.document.location;
    if (this.document.baseURI.endsWith('/oblik/')) {
      location.replace(uiIdlePortalUrl('oblik', location.pathname + location.search));
      return;
    }
    const returnUrl = this.router.url !== '/' ? this.router.url : undefined;
    await this.router.navigate(['/login'], { queryParams: { reason: 'idle', returnUrl } });
  }

  /** `reason: 'idle'` — signed out after inactivity: the login page explains it and returns to `returnUrl`. */
  async logout(opts: LogoutOptions = {}): Promise<void> {
    const fromPortal = this._user()?.via === 'portal';
    await firstValueFrom(this.http.post<void>('api/auth/logout', {})).catch(() => undefined);
    this._user.set(null);
    // came in from the portal (the module behind /oblik/) — back to the portal, still signed in there
    if (fromPortal && this.document.baseURI.endsWith('/oblik/')) {
      this.document.location.assign(PORTAL_HOME);
      return;
    }
    const returnUrl = opts.returnUrl && opts.returnUrl !== '/' ? opts.returnUrl : undefined;
    await this.router.navigate(['/login'], {
      queryParams: opts.reason ? { reason: opts.reason, returnUrl } : {},
    });
  }
}

/** '/api/auth/login/code' → 'api/auth/login/code' (the app's requests are relative to its base href). */
const apiPath = (path: string) => path.replace(/^\//, '');
