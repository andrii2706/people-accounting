/**
 * A service of which every method is a spy resolving to `value` (or what `over` sets) — for the controllers,
 * whose tests check the access rules, the journal and what is passed on.
 */
import { vi } from 'vitest';

export type SpyService = Record<string, ReturnType<typeof vi.fn>>;

export function spyService(over: Record<string, unknown> = {}, value: unknown = {}): SpyService {
  const spies: SpyService = {};
  for (const [k, v] of Object.entries(over)) spies[k] = typeof v === 'function' && 'mock' in v ? (v as ReturnType<typeof vi.fn>) : vi.fn(async () => v);
  return new Proxy(spies, {
    get: (target, key: string) => (target[key] ??= vi.fn(async () => value)),
  });
}
