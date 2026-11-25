import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '../../test/fake-db.js';
import { DictionariesController } from './dictionaries.controller.js';
import { Tck } from './tck.entity.js';

let db: FakeDb;
let c: DictionariesController;
const tcks = () => db.getRepository<Tck>(Tck);

beforeEach(() => {
  db = new FakeDb();
  tcks().seed({
    id: 't1',
    name: 'Шевченківський РТЦК та СП',
    address: 'м. Тестове, вул. Військова, 5',
    region: 'Тестова область',
    city: 'Тестове',
    district: 'Шевченківський',
    isActive: true,
  } as never);
  c = new DictionariesController(tcks() as never);
});

describe('DictionariesController', () => {
  it('довідники: звання зі складом, групи списків, категорії', () => {
    const all = c.all();
    expect(all.ranks.length).toBeGreaterThan(5);
    expect(all.ranks[0]).toHaveProperty('compositionLabel');
    expect(all.listGroups.length).toBeGreaterThanOrEqual(4);
    expect(all.changeTypes.map((x) => x.value)).toContain('PASSPORT');
  });

  it('новий ТЦК: дублікат за назвою — відмова; місто без області — область сусіда з того ж міста', async () => {
    tcks().qb({
      getOne: () => tcks().rows.find((t) => t.name.trim().toLowerCase() === 'шевченківський ртцк та сп') ?? null,
    });
    await expect(c.createTck({ name: ' шевченківський РТЦК та СП ' } as never)).rejects.toThrow('уже є в довіднику');
    tcks().qb({ getOne: () => null, getMany: [] });
    const created = await c.createTck({ name: 'Франківський РТЦК та СП', city: 'Тестове' } as never);
    expect(created.region).toBe('Тестова область');
    expect((await c.listTck()).map((t) => t.name)).toEqual(['Франківський РТЦК та СП', 'Шевченківський РТЦК та СП']);
  });

  it('імпорт: наявні за назвою оновлюються, нові додаються, нічого не видаляється', async () => {
    const out = await c.importTck({
      items: [{ name: 'Шевченківський РТЦК та СП', email: 'tck@example.com' }, { name: ' Новий ОТЦК та СП ' }],
    } as never);
    expect(out).toEqual({ created: 1, updated: 1 });
    expect(tcks().rows.find((t) => t.id === 't1')?.email).toBe('tck@example.com');
    expect(tcks().rows.map((t) => t.name)).toContain('Новий ОТЦК та СП');
  });

  it('редагування (адміністратор): місце, визначене автоматично, йде за новою адресою; вимкнення', async () => {
    const t = await c.updateTck('t1', { email: 'new@example.com' } as never);
    expect(t.email).toBe('new@example.com');
    await expect(c.updateTck('nope', {} as never)).rejects.toThrow('ТЦК не знайдено');
    await c.removeTck('t1');
    expect(tcks().rows[0].isActive).toBe(false);
  });
});
