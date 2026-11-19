import { APPS } from '../../../platform/contracts/apps';

/** «Військовий облік · Облік працівників (незабаром)» — the applications of an account for the user list. */
export function modulesLabel(role: string, modules: readonly string[] | undefined): string {
  if (role === 'ADMIN') return 'усі модулі';
  const own = new Set(modules?.length ? modules : ['oblik']);
  return APPS.filter((a) => own.has(a.id))
    .map((a) => (a.ready ? a.title : `${a.title} (незабаром)`))
    .join(' · ');
}

/** The list with `id` added or removed, in the order of the domain. */
export function toggleModule(modules: readonly string[], id: string): string[] {
  const set = new Set(modules);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return APPS.filter((a) => set.has(a.id)).map((a) => a.id);
}

/** May this account open «Військовий облік» (the main administrator — always; older sessions without the list — yes). */
export function hasOblik(user: { role: string; modules?: string[] }): boolean {
  return user.role === 'ADMIN' || !user.modules || user.modules.includes('oblik');
}
