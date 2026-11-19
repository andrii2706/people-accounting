/**
 * The applications of the system — one domain, each under its own path:
 *   /        portal (sign-in, the list of applications)
 *   /oblik/  військовий облік   /kadry/  облік працівників   /docs/  документообіг
 *   /time/   робочий час        /logistics/  логістика
 * Every application is its own repository with its own frontend, backend, database and nginx.
 */
export const APP_IDS = ['oblik', 'kadry', 'docs', 'time', 'logistics'] as const;
export type AppId = (typeof APP_IDS)[number];

export interface AppInfo {
  id: AppId;
  title: string;
  description: string;
  /** Where the application lives on the domain (with the trailing slash). */
  path: string;
  /** false — the application is not deployed yet: the portal shows it as «незабаром», links lead nowhere. */
  ready: boolean;
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
    ready: false,
  },
  {
    id: 'docs',
    title: 'Документообіг',
    description: 'Накази, службові записки, погодження й підпис КЕП',
    path: '/docs/',
    ready: false,
  },
  {
    id: 'time',
    title: 'Робочий час',
    description: 'Відмітки, таймшити, табель П-5',
    path: '/time/',
    ready: false,
  },
  {
    id: 'logistics',
    title: 'Логістика',
    description: 'Рейси, маршрути, диспетчерська й режим праці водіїв',
    path: '/logistics/',
    ready: false,
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
