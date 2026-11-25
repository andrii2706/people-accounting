/**
 * In-memory stand-in for TypeORM in unit tests: repositories, an entity manager, a data source and transactions.
 *
 * Relations, column defaults and generated columns come from the decorators of the entities
 * (getMetadataArgsStorage), so the services under test see rows shaped as TypeORM would load them.
 * Supported: find / findOne / findBy / findOneBy (+ OrFail), count / exists, create / save / insert / update /
 * delete / remove / merge / increment, where with nested relations, OR (an array), and the operators
 * In, IsNull, Not, LessThan(OrEqual), MoreThan(OrEqual), Between, Like / ILike, And.
 * Query builders are chainable stubs: their results are set per repository with `qb()`.
 *
 * Only for tests — never part of the build (tsconfig.build excludes «test»).
 */
import { randomUUID } from 'node:crypto';
import { FindOperator, getMetadataArgsStorage, type ObjectLiteral } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EntityClass = Function;

interface RelationInfo {
  property: string;
  kind: 'one' | 'many';
  target: () => EntityClass;
  /** Column holding the id: on this row (one) or on the child rows (many). */
  column: string;
}

/** Results of query builders of one repository; each terminal method may be a value or a function. */
export interface QbResults {
  getMany?: unknown[] | (() => unknown[]);
  getOne?: unknown;
  getRawMany?: unknown[] | (() => unknown[]);
  getRawOne?: unknown;
  getCount?: number;
  getManyAndCount?: [unknown[], number];
  execute?: unknown;
}

const storage = () => getMetadataArgsStorage();

/** The class and its parents — decorators of a base class apply to the children too. */
function chain(entity: EntityClass): EntityClass[] {
  const out: EntityClass[] = [];
  for (let c = entity; c && c !== Object && c !== Function.prototype; c = Object.getPrototypeOf(c)) out.push(c);
  return out;
}

const relationCache = new Map<EntityClass, RelationInfo[]>();

function relationsOf(entity: EntityClass): RelationInfo[] {
  const cached = relationCache.get(entity);
  if (cached) return cached;
  const targets = chain(entity);
  const out: RelationInfo[] = [];
  for (const r of storage().relations) {
    if (!targets.includes(r.target as EntityClass)) continue;
    const target = r.type as () => EntityClass;
    if (r.relationType === 'many-to-one' || r.relationType === 'one-to-one') {
      const jc = storage().joinColumns.find(
        (j) => targets.includes(j.target as EntityClass) && j.propertyName === r.propertyName,
      );
      if (r.relationType === 'one-to-one' && !jc) continue; // the inverse side of one-to-one
      out.push({ property: r.propertyName, kind: 'one', target, column: jc?.name ?? `${r.propertyName}Id` });
    } else if (r.relationType === 'one-to-many') {
      const inverse = r.inverseSideProperty;
      const inverseName =
        typeof inverse === 'function'
          ? (() => {
              // the inverse side is given as (child) => child.parent — read the property it touches
              let touched = '';
              const probe = new Proxy({}, { get: (_t, p) => ((touched = String(p)), undefined) });
              (inverse as (x: unknown) => unknown)(probe);
              return touched;
            })()
          : String(inverse ?? '');
      out.push({ property: r.propertyName, kind: 'many', target, column: '', inverseName } as RelationInfo & {
        inverseName: string;
      });
    }
  }
  relationCache.set(entity, out);
  return out;
}

/** The FK column on the child for a one-to-many relation (resolved lazily — the child class may load later). */
function manyColumn(rel: RelationInfo & { inverseName?: string }): string {
  if (rel.column) return rel.column;
  const child = rel.target();
  const back = relationsOf(child).find((r) => r.kind === 'one' && r.property === rel.inverseName);
  rel.column = back?.column ?? `${rel.inverseName}Id`;
  return rel.column;
}

function defaultsOf(entity: EntityClass): Row {
  const targets = chain(entity);
  const out: Row = {};
  for (const c of storage().columns) {
    if (!targets.includes(c.target as EntityClass)) continue;
    const opts = c.options ?? {};
    if (c.mode === 'createDate' || c.mode === 'updateDate') out[c.propertyName] = () => new Date();
    else if (opts.default !== undefined && typeof opts.default !== 'function') out[c.propertyName] = opts.default;
    else if (opts.nullable) out[c.propertyName] = null;
  }
  for (const g of storage().generations) {
    if (targets.includes(g.target as EntityClass))
      out[g.propertyName] = g.strategy === 'increment' ? 'increment' : 'uuid';
  }
  return out;
}

const primaryCache = new Map<EntityClass, string[]>();

/** The primary key columns of the entity (id by default). */
function primaryOf(entity: EntityClass): string[] {
  const cached = primaryCache.get(entity);
  if (cached) return cached;
  const targets = chain(entity);
  const keys = storage()
    .columns.filter((c) => targets.includes(c.target as EntityClass) && c.options?.primary)
    .map((c) => c.propertyName);
  const out = keys.length ? keys : ['id'];
  primaryCache.set(entity, out);
  return out;
}

const isPlainObject = (v: unknown): v is Row =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  !(v instanceof FindOperator) &&
  !Buffer.isBuffer(v);

const norm = (v: unknown) => (v instanceof Date ? v.getTime() : v === undefined ? null : v);

function likeToRegExp(pattern: string, flags = '') {
  const body = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${body}$`, flags);
}

function applyOperator(value: unknown, op: FindOperator<unknown>): boolean {
  const arg = op.value as unknown;
  switch (op.type) {
    case 'isNull':
      return value === null || value === undefined;
    case 'in':
      return (arg as unknown[]).map(norm).includes(norm(value));
    case 'any':
      return (arg as unknown[]).map(norm).includes(norm(value));
    case 'not':
      return arg instanceof FindOperator ? !applyOperator(value, arg) : norm(value) !== norm(arg);
    case 'lessThan':
      return value !== null && value !== undefined && (norm(value) as number) < (norm(arg) as number);
    case 'lessThanOrEqual':
      return value !== null && value !== undefined && (norm(value) as number) <= (norm(arg) as number);
    case 'moreThan':
      return value !== null && value !== undefined && (norm(value) as number) > (norm(arg) as number);
    case 'moreThanOrEqual':
      return value !== null && value !== undefined && (norm(value) as number) >= (norm(arg) as number);
    case 'between': {
      const [a, b] = arg as unknown[];
      return (
        value !== null &&
        value !== undefined &&
        (norm(value) as number) >= (norm(a) as number) &&
        (norm(value) as number) <= (norm(b) as number)
      );
    }
    case 'like':
      return typeof value === 'string' && likeToRegExp(String(arg)).test(value);
    case 'ilike':
      return typeof value === 'string' && likeToRegExp(String(arg), 'i').test(value);
    case 'and':
      return (arg as FindOperator<unknown>[]).every((o) => applyOperator(value, o));
    case 'equal':
      return norm(value) === norm(arg);
    default:
      throw new Error(`fake-db: the operator «${op.type}» is not supported`);
  }
}

export class FakeRepository<T extends ObjectLiteral = Row> {
  readonly rows: Row[] = [];
  private qbResults: QbResults = {};
  private seq = 0;
  readonly metadata: { tableName: string; name: string; target: EntityClass };

  constructor(
    private readonly db: FakeDb,
    readonly entity: EntityClass,
  ) {
    this.metadata = { tableName: entity.name.toLowerCase(), name: entity.name, target: entity };
  }

  /** The entity manager of the fake database (repo.manager.findOneBy(Entity, …) etc.). */
  get manager(): Row {
    return this.db.manager;
  }

  /** Sets the results of query builders of this repository. */
  qb(results: QbResults): this {
    this.qbResults = { ...this.qbResults, ...results };
    return this;
  }

  /** Adds rows as if they were in the database (defaults and ids filled in). */
  seed(...rows: Partial<T>[]): T[] {
    return rows.map((r) => this.store(this.create(r)));
  }

  // ── reading ─────────────────────────────────────────────────────────────────────────────────────────
  async find(opts: Row = {}): Promise<T[]> {
    return this.select(opts);
  }
  async findBy(where: Row | Row[]): Promise<T[]> {
    return this.select({ where });
  }
  async findOne(opts: Row = {}): Promise<T | null> {
    return this.select({ ...opts, take: 1 })[0] ?? null;
  }
  async findOneBy(where: Row | Row[]): Promise<T | null> {
    return this.select({ where, take: 1 })[0] ?? null;
  }
  async findOneOrFail(opts: Row = {}): Promise<T> {
    const row = await this.findOne(opts);
    if (!row) throw new Error(`fake-db: ${this.entity.name} not found`);
    return row;
  }
  async findOneByOrFail(where: Row | Row[]): Promise<T> {
    return this.findOneOrFail({ where });
  }
  async findAndCount(opts: Row = {}): Promise<[T[], number]> {
    const all = this.select({ ...opts, take: undefined, skip: undefined });
    return [this.select(opts), all.length];
  }
  async count(opts: Row = {}): Promise<number> {
    return this.select({ ...opts, take: undefined, skip: undefined }).length;
  }
  async countBy(where: Row | Row[]): Promise<number> {
    return this.count({ where });
  }
  async exists(opts: Row = {}): Promise<boolean> {
    return (await this.count(opts)) > 0;
  }
  async existsBy(where: Row | Row[]): Promise<boolean> {
    return this.exists({ where });
  }

  // ── writing ─────────────────────────────────────────────────────────────────────────────────────────
  create(data: Partial<T> = {}): T {
    const row = Object.create(this.entity.prototype) as Row;
    return Object.assign(row, data) as T;
  }
  merge(target: T, ...sources: Partial<T>[]): T {
    return Object.assign(target, ...sources);
  }
  async save<X extends Partial<T> | Partial<T>[]>(input: X): Promise<X> {
    if (Array.isArray(input)) {
      for (const x of input) this.store(x as Row);
      return input;
    }
    this.store(input as Row);
    return input;
  }
  async insert(input: Partial<T> | Partial<T>[]) {
    const list = Array.isArray(input) ? input : [input];
    for (const x of list) this.store(this.create(x));
    return { identifiers: list.map((x) => ({ id: (x as Row).id })), generatedMaps: [], raw: [] };
  }
  async update(criteria: unknown, patch: Partial<T>) {
    const hits = this.matchCriteria(criteria);
    for (const r of hits) Object.assign(r, patch);
    return { affected: hits.length, raw: [], generatedMaps: [] };
  }
  async increment(where: Row, column: string, by: number) {
    const hits = this.matchCriteria(where);
    for (const r of hits) r[column] = Number(r[column] ?? 0) + by;
    return { affected: hits.length, raw: [], generatedMaps: [] };
  }
  async delete(criteria: unknown) {
    const hits = new Set(this.matchCriteria(criteria));
    this.removeRows(hits);
    return { affected: hits.size, raw: [] };
  }
  async remove<X extends T | T[]>(input: X): Promise<X> {
    const list = (Array.isArray(input) ? input : [input]) as Row[];
    this.removeRows(
      new Set(
        this.rows.filter((r) =>
          list.some((x) => x === r || (this.keyOf(x) !== null && this.keyOf(x) === this.keyOf(r))),
        ),
      ),
    );
    return input;
  }
  async softDelete(criteria: unknown) {
    return this.delete(criteria);
  }
  async upsert(input: Partial<T> | Partial<T>[], conflict: string[] | { conflictPaths: string[] }) {
    const keys = Array.isArray(conflict) ? conflict : conflict.conflictPaths;
    for (const x of (Array.isArray(input) ? input : [input]) as Row[]) {
      const hit = this.rows.find((r) => keys.every((k) => norm(r[k]) === norm(x[k])));
      if (hit) Object.assign(hit, x);
      else this.store(this.create(x as Partial<T>));
    }
    return { identifiers: [], generatedMaps: [], raw: [] };
  }
  async clear() {
    this.rows.length = 0;
  }
  async query(): Promise<unknown[]> {
    return [];
  }

  createQueryBuilder(): FakeQueryBuilder {
    return fakeQueryBuilder(this.qbResults, () => this.select({}));
  }

  // ── internals ───────────────────────────────────────────────────────────────────────────────────────
  /** Stores the row (by reference, as TypeORM returns the saved object) and cascades its child lists. */
  store(row: Row): T {
    const defaults = defaultsOf(this.entity);
    for (const [k, v] of Object.entries(defaults)) {
      if (row[k] !== undefined) continue;
      if (v === 'uuid') row[k] = randomUUID();
      else if (v === 'increment') row[k] = ++this.seq;
      else if (typeof v === 'function') row[k] = (v as () => unknown)();
      else row[k] = v !== null && typeof v === 'object' ? structuredClone(v) : v;
    }
    if (defaults.updatedAt) row.updatedAt = new Date();
    if (!this.rows.includes(row)) {
      const key = this.keyOf(row);
      const i = key !== null ? this.rows.findIndex((r) => this.keyOf(r) === key) : -1;
      if (i >= 0) this.rows[i] = row;
      else this.rows.push(row);
    }
    // one-to-many lists set on the row are saved into the child tables (cascade), with the FK filled in
    for (const rel of relationsOf(this.entity)) {
      const value = row[rel.property];
      if (rel.kind === 'many' && Array.isArray(value)) {
        const child = this.db.getRepository(rel.target());
        const col = manyColumn(rel);
        // orphans: children of this row no longer in the list
        child.removeRows(new Set(child.rows.filter((c) => c[col] === row.id && !value.includes(c))));
        for (const c of value as Row[]) {
          c[col] = row.id;
          child.store(c);
        }
      } else if (rel.kind === 'one' && value && typeof value === 'object' && row[rel.column] === undefined) {
        row[rel.column] = (value as Row).id ?? null;
      }
    }
    return row as T;
  }

  /** The primary key of the row as text; null — not set yet. */
  keyOf(row: Row): string | null {
    const values = primaryOf(this.entity).map((k) => row[k]);
    return values.some((v) => v === undefined || v === null) ? null : values.map(String).join('|');
  }

  removeRows(hits: Set<Row>) {
    for (let i = this.rows.length - 1; i >= 0; i--) if (hits.has(this.rows[i])) this.rows.splice(i, 1);
    // ON DELETE CASCADE / SET NULL of rows pointing here — enough for tests: children are dropped
    if (!hits.size) return;
    const ids = new Set([...hits].map((h) => h.id));
    for (const repo of this.db.repositories()) {
      for (const rel of relationsOf(repo.entity)) {
        if (rel.kind !== 'one' || rel.target() !== this.entity) continue;
        const orphans = repo.rows.filter((r) => ids.has(r[rel.column]));
        if (orphans.length && repo !== (this as unknown)) repo.removeRows(new Set(orphans));
      }
    }
  }

  private matchCriteria(criteria: unknown): Row[] {
    if (criteria === undefined || criteria === null) return [];
    const pk = primaryOf(this.entity)[0];
    if (typeof criteria === 'string' || typeof criteria === 'number')
      return this.rows.filter((r) => r[pk] === criteria);
    if (Array.isArray(criteria)) {
      if (criteria.every((c) => typeof c === 'string' || typeof c === 'number'))
        return this.rows.filter((r) => criteria.includes(r[pk]));
      return this.rows.filter((r) => criteria.some((w) => this.matches(r, w as Row)));
    }
    return this.rows.filter((r) => this.matches(r, criteria as Row));
  }

  /** The row with its relations loaded (shallow copies of the related rows — like a fresh SELECT). */
  hydrate(row: Row, depth = 2): Row {
    if (depth <= 0) return row;
    for (const rel of relationsOf(this.entity)) {
      const repo = this.db.getRepository(rel.target());
      if (rel.kind === 'one') {
        const id = row[rel.column];
        const hit = id === null || id === undefined ? null : repo.rows.find((r) => r.id === id);
        row[rel.property] = hit
          ? repo.hydrate(Object.assign(Object.create(Object.getPrototypeOf(hit)), hit), depth - 1)
          : null;
      } else {
        const col = manyColumn(rel);
        row[rel.property] = repo.rows
          .filter((r) => r[col] === row.id)
          .map((r) => Object.assign(Object.create(Object.getPrototypeOf(r)), r));
      }
    }
    return row;
  }

  matches(row: Row, where: Row): boolean {
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      const value = row[key];
      if (cond instanceof FindOperator) {
        if (!applyOperator(value, cond)) return false;
      } else if (isPlainObject(cond)) {
        // a condition on a relation: load it if it is not on the row
        const rel = relationsOf(this.entity).find((r) => r.property === key);
        if (!rel) {
          if (!isPlainObject(value) || !Object.entries(cond).every(([k, v]) => norm(value[k]) === norm(v)))
            return false;
          continue;
        }
        const repo = this.db.getRepository(rel.target());
        if (rel.kind === 'one') {
          const target = repo.rows.find((r) => r.id === row[rel.column]);
          if (!target || !repo.matches(target, cond)) return false;
        } else {
          const col = manyColumn(rel);
          if (!repo.rows.some((r) => r[col] === row.id && repo.matches(r, cond))) return false;
        }
      } else if (norm(value) !== norm(cond)) {
        return false;
      }
    }
    return true;
  }

  private select(opts: Row): T[] {
    const where = opts.where as Row | Row[] | undefined;
    let out = this.rows.filter((r) =>
      !where ? true : Array.isArray(where) ? where.some((w) => this.matches(r, w)) : this.matches(r, where),
    );
    const order = opts.order as Row | undefined;
    if (order) {
      const keys = Object.entries(order).filter(([, d]) => typeof d === 'string' || typeof d === 'number');
      out = [...out].sort((a, b) => {
        for (const [k, dir] of keys) {
          const x = norm(a[k]) as string | number | null;
          const y = norm(b[k]) as string | number | null;
          if (x === y) continue;
          const asc = String(dir).toUpperCase() !== 'DESC' && dir !== -1;
          if (x === null) return asc ? 1 : -1;
          if (y === null) return asc ? -1 : 1;
          return (x < y ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
    }
    if (opts.skip) out = out.slice(opts.skip as number);
    if (opts.take) out = out.slice(0, opts.take as number);
    // a fresh copy per read (as from the database) with the relations loaded
    return out.map((r) => this.hydrate(Object.assign(Object.create(Object.getPrototypeOf(r)), r))) as T[];
  }
}

export type FakeQueryBuilder = Record<string, (...args: unknown[]) => unknown>;

/** A chainable query builder: every method returns the builder, the terminal ones — the set results. */
/**
 * Simple WHERE conditions of a query builder applied to the rows (when no results are set):
 * «a.col = :p», «LOWER(a.col) = LOWER(:p)», «a.col <> :p», «a.col IS [NOT] NULL», «a.col IN (:...p)», joined by AND.
 * Anything else (OR, sub-queries, functions) is ignored — set the results with `qb()` for such queries.
 */
function parseConditions(sql: string, params: Row): ((row: Row) => boolean)[] {
  if (/\bOR\b|EXISTS|SELECT/i.test(sql)) return [];
  const out: ((row: Row) => boolean)[] = [];
  for (const raw of sql.replace(/^\(|\)$/g, '').split(/\s+AND\s+/i)) {
    const part = raw.trim().replace(/^\(|\)$/g, '');
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^LOWER\(\w+\.(\w+)\)\s*=\s*LOWER\(:(\w+)\)$/i))) {
      const [, col, p] = m;
      out.push((r) => String(r[col] ?? '').toLowerCase() === String(params[p] ?? '').toLowerCase());
    } else if ((m = part.match(/^"?\w+"?\."?(\w+)"?\s*=\s*:(\w+)$/))) {
      const [, col, p] = m;
      out.push((r) => norm(r[col]) === norm(params[p]));
    } else if ((m = part.match(/^"?\w+"?\."?(\w+)"?\s*(<>|!=)\s*:(\w+)$/))) {
      const [, col, , p] = m;
      out.push((r) => norm(r[col]) !== norm(params[p]));
    } else if ((m = part.match(/^"?\w+"?\."?(\w+)"?\s+IS\s+(NOT\s+)?NULL$/i))) {
      const [, col, not] = m;
      out.push((r) => (r[col] === null || r[col] === undefined) !== !!not);
    } else if ((m = part.match(/^"?\w+"?\."?(\w+)"?\s+IN\s*\(:\.\.\.(\w+)\)$/i))) {
      const [, col, p] = m;
      out.push((r) => ((params[p] as unknown[]) ?? []).map(norm).includes(norm(r[col])));
    }
  }
  return out;
}

/** A chainable query builder: every method returns the builder, the terminal ones — the set results. */
export function fakeQueryBuilder(results: QbResults, fallback: () => unknown[] = () => []): FakeQueryBuilder {
  const filters: ((row: Row) => boolean)[] = [];
  const rows = () => (fallback() as Row[]).filter((r) => filters.every((f) => f(r)));
  const val = <X>(v: X | (() => X) | undefined, d: X): X => (typeof v === 'function' ? (v as () => X)() : (v ?? d));
  const many = () => val(results.getMany, rows());
  const terminal: Record<string, () => Promise<unknown>> = {
    getMany: async () => many(),
    getOne: async () => val(results.getOne, undefined) ?? many()[0] ?? null,
    getRawMany: async () => val(results.getRawMany, []),
    getRawOne: async () => val(results.getRawOne, null),
    getCount: async () => results.getCount ?? many().length,
    getManyAndCount: async () => results.getManyAndCount ?? [many(), many().length],
    getExists: async () => many().length > 0,
    execute: async () => results.execute ?? { affected: 0, raw: [] },
  };
  const qb: FakeQueryBuilder = new Proxy({} as FakeQueryBuilder, {
    get: (_t, prop: string) => {
      if (prop === 'then') return undefined;
      if (prop in terminal) return terminal[prop];
      if (prop === 'getQuery' || prop === 'getSql') return () => '';
      if (prop === 'getParameters') return () => ({});
      if (prop === 'expressionMap') return { parameters: {} };
      if (prop === 'where' || prop === 'andWhere') {
        return (cond: unknown, params?: Row) => {
          if (typeof cond === 'string') filters.push(...parseConditions(cond, params ?? {}));
          return qb;
        };
      }
      return () => qb;
    },
  });
  return qb;
}

export class FakeDb {
  private readonly repos = new Map<EntityClass, FakeRepository>();
  /** Every raw SQL passed to query(); the answer — from `onQuery`. */
  readonly queries: { sql: string; params?: unknown[] }[] = [];
  onQuery: (sql: string, params?: unknown[]) => unknown = () => [];
  /** How many transactions were opened (and committed — a throw rolls nothing back in the fake). */
  transactions = 0;

  getRepository<T extends ObjectLiteral = Row>(entity: EntityClass): FakeRepository<T> {
    let repo = this.repos.get(entity);
    if (!repo) {
      repo = new FakeRepository(this, entity);
      this.repos.set(entity, repo);
    }
    return repo as unknown as FakeRepository<T>;
  }

  repositories(): FakeRepository[] {
    return [...this.repos.values()];
  }

  /** The entity manager (inside and outside transactions — one and the same here). */
  get manager(): Row {
    const repo = (e: EntityClass) => this.getRepository(e);
    const known: Row = {
      getRepository: repo,
      transaction: (cb: (m: Row) => unknown) => this.transaction(cb),
      query: (sql: string, params?: unknown[]) => this.query(sql, params),
      save: async (a: EntityClass | Row | Row[], b?: Row | Row[]) =>
        typeof a === 'function' ? repo(a).save(b as Row) : this.saveByPrototype(a),
      find: (e: EntityClass, o?: Row) => repo(e).find(o),
      findOne: (e: EntityClass, o?: Row) => repo(e).findOne(o),
      findOneBy: (e: EntityClass, w: Row) => repo(e).findOneBy(w),
      findBy: (e: EntityClass, w: Row) => repo(e).findBy(w),
      count: (e: EntityClass, o?: Row) => repo(e).count(o),
      create: (e: EntityClass, d?: Row) => repo(e).create(d),
      update: (e: EntityClass, c: unknown, p: Row) => repo(e).update(c, p),
      delete: (e: EntityClass, c: unknown) => repo(e).delete(c),
      remove: async (a: Row | Row[]) => {
        for (const x of Array.isArray(a) ? a : [a])
          await repo(Object.getPrototypeOf(x).constructor as EntityClass).remove(x);
        return a;
      },
      insert: (e: EntityClass, d: Row | Row[]) => repo(e).insert(d),
      increment: (e: EntityClass, w: Row, c: string, by: number) => repo(e).increment(w, c, by),
      createQueryBuilder: (e?: EntityClass) => (e ? repo(e).createQueryBuilder() : fakeQueryBuilder({})),
    };
    // any other repository method as manager.<method>(Entity, …args)
    return new Proxy(known, {
      get: (target, prop: string) => {
        if (prop in target) return target[prop];
        return (e: EntityClass, ...args: unknown[]) => {
          const r = repo(e) as unknown as Row;
          if (typeof r[prop] !== 'function') throw new Error(`fake-db: manager.${prop} is not supported`);
          return r[prop](...args);
        };
      },
    });
  }

  /** What @InjectDataSource() gets. */
  get dataSource(): Row {
    return { ...this.manager, manager: this.manager, isInitialized: true };
  }

  async transaction<X>(cb: (m: Row) => X | Promise<X>): Promise<X> {
    this.transactions++;
    return cb(this.manager);
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    this.queries.push({ sql, params });
    return this.onQuery(sql, params);
  }

  private async saveByPrototype(a: Row | Row[]) {
    for (const x of Array.isArray(a) ? a : [a]) {
      await this.getRepository(Object.getPrototypeOf(x).constructor as EntityClass).save(x);
    }
    return a;
  }
}
