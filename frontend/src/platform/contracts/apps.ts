/**
 * The applications of the system — one domain, each under its own path:
 *   /        portal (sign-in, the list of applications)
 *   /oblik/  військовий облік   /kadry/  облік працівників   /projects/  керування проєктами
 * Every application is its own repository with its own frontend, backend, database and nginx.
 */
export const APP_IDS = ['oblik', 'kadry', 'projects'] as const;
export type AppId = (typeof APP_IDS)[number];

export interface AppInfo {
  id: AppId;
  title: string;
  description: string;
  /** Where the application lives on the domain (with the trailing slash). */
  path: string;
  /** false — the application is not deployed yet: the portal shows it as «незабаром», links lead nowhere. */
  ready: boolean;
  /**
   * Its own sign-in page (a module sold on its own): opened without a session of the portal, the module is entered
   * there — with the same account of the portal. None — the sign-in of the portal (or of the module itself).
   */
  loginPath?: string;
}

export const APPS: readonly AppInfo[] = [
  {
    id: 'oblik',
    title: 'Військовий облік',
    description:
      'Призовники, військовозобов’язані й резервісти, повідомлення ТЦК, списки й відомості',
    path: '/oblik/',
    ready: true,
  },
  {
    id: 'kadry',
    title: 'Облік працівників',
    description: 'Особові картки П-2, призначення й переведення, відпустки',
    path: '/kadry/',
    ready: true,
    loginPath: '/kadry/login',
  },
  {
    id: 'projects',
    title: 'Керування проєктами',
    description: 'Проєкти й дошки задач, строки, відповідальні та хід робіт',
    path: '/projects/',
    ready: true,
    loginPath: '/projects/login',
  },
];

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && (APP_IDS as readonly string[]).includes(value);
}

/** The applications this user may open, in the order of APPS. */
export function appsOf(modules: readonly string[] | undefined): AppInfo[] {
  const allowed = new Set(modules ?? []);
  return APPS.filter((a) => allowed.has(a.id));
}

/** The applications this user may open right now (deployed ones). */
export function readyAppsOf(modules: readonly string[] | undefined): AppInfo[] {
  return appsOf(modules).filter((a) => a.ready);
}

/**
 * What a module is for this account right now:
 * open — works; payment — not paid (a debt, no plan, the paid period is over); password — the password is
 * out of date or temporary; terms — the head of the legal entity has not signed the offer yet; setup — the
 * account is not tied to a legal entity yet; off — not connected for the account; soon — not deployed yet.
 */
export type ModuleState = 'open' | 'payment' | 'password' | 'terms' | 'setup' | 'off' | 'soon';

/** A button next to the message of a closed module: where the user fixes it. */
export interface ModuleAction {
  label: string;
  /** A path on the domain (/change-password, /oblik/account/subscription). */
  path: string;
}

/** The state of one module for the signed-in account (GET …/auth/access of the module, /api/portal/me). */
export interface ModuleAccess {
  id: AppId;
  state: ModuleState;
  /** Why it is closed, for the user; '' — open. */
  message: string;
  action?: ModuleAction;
  /** Works, but there is something to know (a debt with one entry left …). */
  notice?: string;
}

/** GET …/auth/access of a module. */
export interface AccessResponse {
  modules: ModuleAccess[];
}

/** Closed for work: the tile is greyed out and the module is not opened. */
export const isBlocked = (state: ModuleState) => state !== 'open';
