// 1000 fictional employees through the import API (the same path as a real import).
// Run against a local copy of the database only: createdb -T military military_perf
import { API as base, signIn } from './config.mjs';
const cookie = await signIn();
const last = ['Перфтест', 'Навантаж', 'Вигадан', 'Умовн', 'Пробн', 'Тестов', 'Зразков', 'Модельн'];
const first = ['Олег', 'Іван', 'Петро', 'Андрій', 'Тарас', 'Богдан', 'Микола', 'Юрій'];
const abc = 'абвгдежзиклмнопрстуфхцчшщюя';
const tag = (n) => abc[n % 27] + abc[Math.floor(n / 27) % 27];
const rows = [];
for (let i = 0; i < 1000; i++) {
  const y = 1970 + (i % 35), m = String(1 + (i % 12)).padStart(2, '0'), d = String(1 + (i % 27)).padStart(2, '0');
  rows.push({
    rowNumber: i + 2,
    values: {
      lastName: `${last[i % 8]}${tag(i)}енко`, firstName: first[i % 8], middleName: 'Іванович', gender: 'M',
      birthDate: `${y}-${m}-${d}`, rankCode: [1, 2, 3, 5, 12, 14][i % 6], vos: i % 6 >= 4 ? '021101' : '100915',
      position: ['оператор', 'водій', 'інженер', 'комірник'][i % 4], hireDate: '2021-03-01', militaryRegistered: true,
      ...(i % 10 === 0 ? { deferralMobilizationBasis: 'п. 9 ч. 1 ст. 23', deferralUntil: '2026-11-20' } : {}),
    },
    issues: [],
  });
}
const res = await fetch(`${base}/employees/import/commit`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ rows, hireNotices: 'NONE', fileName: 'perf.csv' }) });
const t = await res.text(); console.log(res.status, t.slice(0, 120)); try { const j = JSON.parse(t); console.log(JSON.stringify(j.rows?.[0]?.errors), JSON.stringify(j.rows?.[0]?.duplicate)); } catch {}
