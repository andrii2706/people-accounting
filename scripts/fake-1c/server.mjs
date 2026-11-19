#!/usr/bin/env node
/**
 * «Імітація 1С: ЗУП» — a test stand to try the integration with 1C as a user, without 1C.
 * Only fictional people. Node 20+, no dependencies.
 *
 *   node scripts/fake-1c/server.mjs            → http://localhost:3398
 *
 * It plays both sides of a real 1C base:
 *  - the page = the data processor of 1C: edit employees (hire, transfer, rename, dismiss) and press
 *    «Надіслати працівників» — POST to the push address with the key (mode «1С надсилає дані сама»);
 *  - /zup/odata/standard.odata = the published base (mode «Ми читаємо з 1С»): user odata, password secret.
 * The data are kept in scripts/fake-1c/data.json (not in git); «Скинути дані» returns the start set.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.FAKE_1C_PORT ?? 3398);
const DATA = join(dirname(fileURLToPath(import.meta.url)), 'data.json');
const ODATA_USER = 'odata';
const ODATA_PASSWORD = 'secret';
const ODATA_BASE = '/zup/odata/standard.odata/';
const EMPTY_DATE = '0001-01-01T00:00:00';
const EMPTY_REF = '00000000-0000-0000-0000-000000000000';
const PART = 500;

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

// ───────────── fictional start data ─────────────

const ORGS = [
  { id: 'a0000000-0000-4000-8000-000000000001', name: 'ТОВ «Вигадана компанія»', edrpou: '12345678' },
  { id: 'a0000000-0000-4000-8000-000000000002', name: 'ТОВ «Інша компанія»', edrpou: '87654321' },
];

function seed() {
  const person = (n, p) => ({
    id: `e0000000-0000-4000-8000-00000000000${n}`,
    personId: `f0000000-0000-4000-8000-00000000000${n}`,
    personnelNumber: `00${n}`,
    deleted: false,
    names: [{ since: '2010-01-01', lastName: p.lastName, firstName: p.firstName, middleName: p.middleName }],
    military: {},
    dismissalDate: '',
    dismissalOrderNumber: '',
    orgEdrpou: ORGS[0].edrpou,
    rnokpp: '',
    ...p,
  });
  return {
    settings: { url: '', key: '', edrpou: ORGS[0].edrpou },
    employees: [
      person(1, {
        lastName: 'Тестовий', firstName: 'Олег', middleName: 'Петрович', gender: 'M', birthDate: '1988-02-10',
        position: 'інженер', department: 'Технічний відділ', hireDate: daysAgo(10),
      }),
      person(2, {
        lastName: 'Вигадана', firstName: 'Ірина', middleName: 'Олегівна', gender: 'F', birthDate: '1992-07-21',
        position: 'бухгалтер', department: 'Бухгалтерія', hireDate: '2021-05-01',
      }),
      person(3, {
        lastName: 'Прикладний', firstName: 'Сергій', middleName: 'Іванович', gender: 'M', birthDate: '1979-11-03',
        position: 'водій', department: 'Господарський відділ', hireDate: '2019-01-15',
        military: { rank: 'солдат', vos: '837' },
      }),
      person(4, {
        lastName: 'Зразкова', firstName: 'Марія', middleName: 'Іванівна', gender: 'F', birthDate: '1995-03-12',
        position: 'менеджер', department: 'Відділ продажу', hireDate: '2023-09-01',
      }),
      person(5, {
        lastName: 'Давній', firstName: 'Павло', middleName: 'Ігорович', gender: 'M', birthDate: '1970-01-01',
        position: 'комірник', department: 'Склад', hireDate: '2010-01-01', dismissalDate: '2015-01-01',
      }),
      person(6, {
        lastName: 'Чужий', firstName: 'Андрій', middleName: 'Андрійович', gender: 'M', birthDate: '1990-01-01',
        position: 'інженер', department: 'Технічний відділ', hireDate: '2020-01-01', orgEdrpou: ORGS[1].edrpou,
      }),
    ],
  };
}

let state = existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : seed();
const save = () => writeFileSync(DATA, JSON.stringify(state, null, 2));
save();

const current = (e) => e.names.at(-1);
const fullName = (e) => {
  const n = current(e);
  return `${n.lastName} ${n.firstName} ${n.middleName}`.trim();
};
const orgOf = (e) => ORGS.find((o) => o.edrpou === e.orgEdrpou) ?? ORGS[0];

// ───────────── the push (what the data processor of 1C does) ─────────────

const record = (e) => {
  const n = current(e);
  const r = {
    externalId: e.id,
    personnelNumber: e.personnelNumber,
    lastName: n.lastName,
    firstName: n.firstName,
    middleName: n.middleName,
    fullName: fullName(e),
    rnokpp: e.rnokpp,
    birthDate: e.birthDate,
    gender: e.gender,
    position: e.position,
    department: e.department,
    hireDate: e.hireDate,
    dismissalDate: e.dismissalDate,
    dismissalOrderNumber: e.dismissalOrderNumber,
  };
  const m = Object.fromEntries(Object.entries(e.military ?? {}).filter(([, v]) => v));
  if (Object.keys(m).length) r.military = m;
  return r;
};

/** The push address without «/employees» — like the data processor: …/integrations/1c */
const pushBase = (url) => url.trim().replace(/\/+$/, '').replace(/\/employees$/, '');

async function call(method, path, body) {
  const { url, key } = state.settings;
  if (!url || !key) return { status: 0, body: { message: 'Вкажіть адресу і ключ' } };
  try {
    const res = await fetch(pushBase(url) + path, {
      method,
      headers: { authorization: `Bearer ${key.trim()}`, 'content-type': 'application/json; charset=utf-8' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text.slice(0, 300) };
    }
    return { status: res.status, body: json };
  } catch (err) {
    return { status: 0, body: { message: `Немає з'єднання: ${err.cause?.code ?? err.message}` } };
  }
}

const errorText = (r) => {
  const m = r.body?.message;
  return `${r.status ? `Помилка ${r.status}: ` : ''}${Array.isArray(m) ? m.join('; ') : (m ?? '')}`;
};

async function ping() {
  const r = await call('GET', '/ping');
  return r.status === 200
    ? { ok: true, message: `Підключення працює: ${r.body.legalEntity} (ЄДРПОУ ${r.body.edrpou})` }
    : { ok: false, message: errorText(r) };
}

async function push() {
  const list = state.employees
    .filter((e) => !e.deleted && (!state.settings.edrpou || e.orgEdrpou === state.settings.edrpou))
    .map(record);
  if (!list.length) return { ok: false, message: 'Немає працівників цієї організації' };
  let sent = 0;
  let last = null;
  for (let i = 0; i < list.length; i += PART) {
    const part = list.slice(i, i + PART);
    const r = await call('POST', '/employees', { employees: part });
    if (r.status !== 200) return { ok: false, message: `Надіслано ${sent} з ${list.length}. ${errorText(r)}` };
    sent += part.length;
    last = r.body;
  }
  const c = last.counts;
  return {
    ok: true,
    message:
      `Надіслано працівників: ${sent}. Нових: ${c.create}, змін: ${c.update}, звільнень: ${c.dismiss}, ` +
      `без змін: ${c.unchanged}, пропущено: ${c.skip}, помилок: ${c.error}, розбіжностей: ${c.conflict}` +
      (last.status === 'PENDING' ? ' — чекає на перегляд у застосунку' : ' — застосовано'),
  };
}

// ───────────── the published base (standard OData of ЗУП) ─────────────

const ref = (text) => {
  if (!text) return EMPTY_REF;
  const h = createHash('sha1').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const odate = (d) => (d ? `${d}T00:00:00` : EMPTY_DATE);

function tables() {
  const list = state.employees.filter((e) => !e.deleted);
  const positions = [...new Set(list.map((e) => e.position).filter(Boolean))];
  const departments = [...new Set(list.map((e) => e.department).filter(Boolean))];
  return {
    Catalog_Организации: ORGS.map((o) => ({ Ref_Key: o.id, Description: o.name, КодПоЕДРПОУ: o.edrpou })),
    Catalog_Должности: positions.map((p) => ({ Ref_Key: ref(`p:${p}`), Description: p })),
    Catalog_ПодразделенияОрганизаций: departments.map((d) => ({ Ref_Key: ref(`d:${d}`), Description: d })),
    Catalog_ФизическиеЛица: list.map((e) => ({
      Ref_Key: e.personId,
      Description: fullName(e),
      ДатаРождения: odate(e.birthDate),
      Пол: e.gender === 'F' ? 'Женский' : 'Мужской',
      КодПоДРФО: e.rnokpp,
    })),
    Catalog_Сотрудники: list.map((e) => ({
      Ref_Key: e.id,
      DeletionMark: false,
      Code: e.personnelNumber,
      Description: fullName(e),
      ФизическоеЛицо_Key: e.personId,
      ГоловнаяОрганизация_Key: orgOf(e).id,
      ВАрхиве: false,
    })),
    InformationRegister_ТекущиеКадровыеДанныеСотрудников: list.map((e) => ({
      Сотрудник_Key: e.id,
      ТекущаяОрганизация_Key: orgOf(e).id,
      ТекущаяДолжность_Key: ref(e.position && `p:${e.position}`),
      ТекущееПодразделение_Key: ref(e.department && `d:${e.department}`),
      ДатаПриема: odate(e.hireDate),
      ДатаУвольнения: odate(e.dismissalDate),
    })),
    InformationRegister_ФИОФизическихЛиц: list.flatMap((e) =>
      e.names.map((n) => ({
        Period: odate(n.since),
        ФизическоеЛицо_Key: e.personId,
        Фамилия: n.lastName,
        Имя: n.firstName,
        Отчество: n.middleName,
      })),
    ),
  };
}

const metadata = () =>
  `<?xml version="1.0" encoding="utf-8"?><edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"><edmx:DataServices><Schema Namespace="StandardODATA">${Object.entries(
    tables(),
  )
    .map(([name, rows]) => {
      const props = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      return `<EntityType Name="${name}">${props.map((p) => `<Property Name="${p}" Type="Edm.String"/>`).join('')}</EntityType>`;
    })
    .join('')}</Schema></edmx:DataServices></edmx:Edmx>`;

function odata(req, res, url) {
  const expected = 'Basic ' + Buffer.from(`${ODATA_USER}:${ODATA_PASSWORD}`).toString('base64');
  if (req.headers.authorization !== expected) {
    res.writeHead(401, { 'www-authenticate': 'Basic realm="1C"' });
    return res.end('Unauthorized');
  }
  const table = decodeURIComponent(url.pathname.slice(ODATA_BASE.length));
  if (table === '$metadata') {
    res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
    return res.end(metadata());
  }
  const rows = tables()[table];
  if (!rows) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const skip = Number(url.searchParams.get('$skip') ?? 0);
  const top = Number(url.searchParams.get('$top') ?? 1000);
  const select = (url.searchParams.get('$select') ?? '').split(',').filter(Boolean);
  const page = rows
    .slice(skip, skip + top)
    .map((r) => (select.length ? Object.fromEntries(select.filter((k) => k in r).map((k) => [k, r[k]])) : r));
  log(`OData: застосунок прочитав ${table} (${page.length})`);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ 'odata.metadata': `${ODATA_BASE}$metadata#${table}`, value: page }));
}

// ───────────── the page and its small API ─────────────

const journal = [];
const log = (text) => {
  const last = journal[0];
  if (last && last.text === text) return; // the same OData read of many pages — once
  journal.unshift({ at: new Date().toLocaleTimeString('uk-UA'), text });
  journal.length = Math.min(journal.length, 30);
};

const view = () => ({
  settings: state.settings,
  orgs: ORGS,
  odata: { url: `http://localhost:${PORT}/zup`, user: ODATA_USER, password: ODATA_PASSWORD },
  journal,
  employees: state.employees
    .filter((e) => !e.deleted)
    .map((e) => ({ ...e, ...current(e), fullName: fullName(e), org: orgOf(e).name, previous: e.names.slice(0, -1) })),
});

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const isDate = (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);

function upsert(body) {
  const p = {
    lastName: clean(body.lastName, 60),
    firstName: clean(body.firstName, 60),
    middleName: clean(body.middleName, 60),
    gender: body.gender === 'F' ? 'F' : 'M',
    birthDate: clean(body.birthDate, 10),
    rnokpp: clean(body.rnokpp, 10),
    personnelNumber: clean(body.personnelNumber, 20),
    orgEdrpou: ORGS.some((o) => o.edrpou === body.orgEdrpou) ? body.orgEdrpou : ORGS[0].edrpou,
    position: clean(body.position, 100),
    department: clean(body.department, 100),
    hireDate: clean(body.hireDate, 10),
    dismissalDate: clean(body.dismissalDate, 10),
    dismissalOrderNumber: clean(body.dismissalOrderNumber, 20),
    military: {
      rank: clean(body.rank, 60),
      vos: clean(body.vos, 20),
      registryNumber: clean(body.registryNumber, 30),
      tck: clean(body.tck, 200),
    },
  };
  if (!p.lastName || !p.firstName) throw new Error('Прізвище та ім’я обов’язкові');
  // a wrong date is kept on purpose (to see «Помилка в даних»), only the format is checked here
  for (const d of [p.hireDate, p.dismissalDate]) if (!isDate(d)) throw new Error('Дата — у форматі РРРР-ММ-ДД');
  const existing = state.employees.find((e) => e.id === body.id);
  const name = { lastName: p.lastName, firstName: p.firstName, middleName: p.middleName };
  if (existing) {
    const before = current(existing);
    const renamed = ['lastName', 'firstName', 'middleName'].some((k) => before[k] !== name[k]);
    const { lastName, firstName, middleName, ...rest } = p;
    Object.assign(existing, rest);
    // a new name is a new record of the register «ФИО физических лиц» — like in ЗУП
    if (renamed) existing.names.push({ since: today(), ...name });
    log(`Змінено: ${fullName(existing)}`);
    return;
  }
  const number = String(state.employees.length + 1).padStart(3, '0');
  const e = {
    id: randomUUID(),
    personId: randomUUID(),
    deleted: false,
    ...p,
    personnelNumber: p.personnelNumber || number,
    names: [{ since: p.birthDate || today(), ...name }],
  };
  delete e.lastName;
  delete e.firstName;
  delete e.middleName;
  state.employees.push(e);
  log(`Прийнято: ${fullName(e)}`);
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
  });

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith(ODATA_BASE)) return odata(req, res, url);
    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html')));
    }
    if (url.pathname === '/__/state') return json(res, 200, view());
    if (req.method !== 'POST') return json(res, 404, { message: 'Not found' });
    const body = await readBody(req);
    switch (url.pathname) {
      case '/__/settings':
        state.settings = { url: clean(body.url, 300), key: clean(body.key, 100), edrpou: clean(body.edrpou, 10) };
        save();
        return json(res, 200, view());
      case '/__/employee':
        upsert(body);
        save();
        return json(res, 200, view());
      case '/__/dismiss': {
        const e = state.employees.find((x) => x.id === body.id);
        if (e) {
          e.dismissalDate = clean(body.date, 10) || today();
          e.dismissalOrderNumber = clean(body.order, 20) || `${e.personnelNumber}-к`;
          log(`Звільнено: ${fullName(e)} з ${e.dismissalDate}`);
          save();
        }
        return json(res, 200, view());
      }
      case '/__/delete': {
        const e = state.employees.find((x) => x.id === body.id);
        if (e) {
          e.deleted = true;
          log(`Видалено з 1С (помилково внесений): ${fullName(e)}`);
          save();
        }
        return json(res, 200, view());
      }
      case '/__/ping': {
        const r = await ping();
        log(r.message);
        return json(res, 200, { ...r, state: view() });
      }
      case '/__/push': {
        const r = await push();
        log(r.message);
        return json(res, 200, { ...r, state: view() });
      }
      case '/__/reset': {
        const settings = state.settings;
        state = seed();
        state.settings = settings;
        journal.length = 0;
        log('Дані повернуто до початкових');
        save();
        return json(res, 200, view());
      }
      default:
        return json(res, 404, { message: 'Not found' });
    }
  } catch (err) {
    return json(res, 400, { message: err instanceof Error ? err.message : 'Помилка' });
  }
});

server.listen(PORT, () => {
  console.log(`Імітація 1С: http://localhost:${PORT}`);
  console.log(`OData для застосунку: http://localhost:${PORT}/zup  (користувач ${ODATA_USER}, пароль ${ODATA_PASSWORD})`);
});
