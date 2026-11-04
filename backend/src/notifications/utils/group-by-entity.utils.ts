/** Items grouped by their legal entity (null — without one), in the order they come. */
export function groupByEntity<T>(items: T[], entityOf: (item: T) => string | null): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const key = entityOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
