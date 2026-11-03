import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'node:fs';

import { chromium } from 'playwright';
import { API, APP as BASE, signIn } from './config.mjs';

const cookie = await signIn();
const list = await (await fetch(`${API}/employees`, { headers: { cookie } })).json();
const pages = [
  ['Вхід', '/login', false],
  ['Огляд', '/', true],
  ['Працівники (1015)', '/employees', true],
  ['Картка', `/employees/${list.items[0].id}/edit`, true],
  ['Списки Дод. 5', '/reports/lists', true],
];
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
const rows = [];
for (const formFactor of ['desktop', 'mobile']) {
  for (const [name, path, auth] of pages) {
    const config = formFactor === 'desktop'
      ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }, onlyCategories: ['performance', 'accessibility', 'best-practices'] } }
      : { extends: 'lighthouse:default', settings: { onlyCategories: ['performance', 'accessibility', 'best-practices'] } };
    const r = await lighthouse(BASE + path, { port: chrome.port, output: 'json', logLevel: 'error', extraHeaders: auth ? { cookie } : {} }, config);
    const a = r.lhr.audits, c = r.lhr.categories;
    const row = {
      formFactor, name,
      perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c['best-practices'].score * 100),
      FCP: a['first-contentful-paint'].displayValue, LCP: a['largest-contentful-paint'].displayValue,
      TBT: a['total-blocking-time'].displayValue, CLS: a['cumulative-layout-shift'].displayValue, SI: a['speed-index'].displayValue,
      bytes: Math.round(a['total-byte-weight'].numericValue / 1024) + ' KB', final: r.lhr.finalDisplayedUrl.replace(BASE, ''),
      fails: Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && ['accessibility', 'best-practices'].some((k) => c[k].auditRefs.some((ref) => ref.id === x.id && ref.weight > 0))).map((x) => x.id),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync('lighthouse.json', JSON.stringify(rows, null, 2));
await chrome.kill();
