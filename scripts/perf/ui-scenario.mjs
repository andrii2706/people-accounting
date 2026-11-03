// Runtime metrics of the UI with 1015 employees; CPU slowed down 4x (an average office laptop)
import { chromium } from 'playwright';
import { APP, EMAIL, PASSWORD } from './config.mjs';
await (async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    window.__long = 0; window.__longCount = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__long += e.duration; window.__longCount++; } }).observe({ type: 'longtask', buffered: true });
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    window.__lcp = 0;
    new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0;
  p.on('requestfinished', async (r) => { try { const s = await r.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; } catch {} });
  const reset = () => p.evaluate(() => { window.__long = 0; window.__longCount = 0; });
  const stats = async (label, t0) => {
    const s = await p.evaluate(() => ({ long: Math.round(window.__long), n: window.__longCount, dom: document.getElementsByTagName('*').length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, cls: +window.__cls.toFixed(3), lcp: Math.round(window.__lcp) }));
    console.log(`${label.padEnd(34)} ${String(Math.round(performance.now() - t0)).padStart(6)} ms | long tasks ${String(s.long).padStart(5)} ms (${s.n}) | DOM ${s.dom} | heap ${s.heap} MB | CLS ${s.cls} | LCP ${s.lcp}`);
  };

  let t = performance.now();
  await p.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await stats('login page', t);
  await p.fill('input[type=email]', EMAIL);
  await p.fill('input[type=password]', PASSWORD);
  await reset(); t = performance.now();
  await p.click('button[type=submit]');
  await p.getByRole('dialog', { name: /Нові сповіщення/ }).waitFor();
  await stats('login → dashboard + popup', t);
  await p.keyboard.press('Escape');

  await reset(); bytes = 0; t = performance.now();
  await p.getByRole('link', { name: 'Працівники' }).first().click();
  await p.locator('tbody tr').nth(99).waitFor();
  await stats('→ employees (1015 rows)', t); console.log('   transferred', Math.round(bytes / 1024), 'KB');

  await reset(); t = performance.now();
  await p.locator('input[type=search]').first().fill('пробн');
  await p.waitForFunction(() => document.querySelectorAll('tbody tr').length < 300, null, { timeout: 15000 });
  await stats('search «пробн»', t);
  await p.locator('input[type=search]').first().fill('');
  await p.locator('tbody tr').nth(99).waitFor();

  await reset(); t = performance.now();
  await p.getByRole('button', { name: /^Відстрочка/ }).click();
  await p.waitForFunction(() => document.querySelectorAll('tbody tr').length < 200);
  await stats('tab «Відстрочка»', t);
  await p.getByRole('button', { name: /^Усі/ }).click();
  await p.locator('tbody tr').nth(99).waitFor();

  await reset(); t = performance.now();
  await p.getByRole('checkbox', { name: 'Вибрати всіх' }).check();
  await p.getByText(/Вибрано 10\d\d/).waitFor();
  await stats('select all', t);
  await p.getByRole('button', { name: 'Скасувати вибір' }).click();

  await reset(); t = performance.now();
  await p.getByRole('button', { name: /^Переглянути:/ }).nth(60).click();
  await p.getByRole('link', { name: 'Відкрити картку' }).waitFor();
  await stats('open side panel', t);

  await reset(); t = performance.now();
  await p.getByRole('link', { name: 'Огляд' }).first().click();
  await p.getByText('Що зробити сьогодні').waitFor();
  await stats('→ dashboard', t);

  await reset(); t = performance.now();
  await p.keyboard.press('Control+k');
  await p.keyboard.type('умовн');
  await p.locator('[role=option]').first().waitFor();
  await p.waitForTimeout(600);
  await stats('Ctrl K search', t);
  await p.keyboard.press('Escape');

  await reset(); t = performance.now();
  const id = await p.evaluate(async () => (await (await fetch('/api/employees?search=умовн')).json()).items[0].id);
  await p.goto(`${APP}/employees/${id}/edit`, { waitUntil: 'networkidle' });
  await stats('employee form (full load)', t);

  await reset(); t = performance.now();
  await p.locator('app-form-field', { hasText: 'Телефон' }).locator('input').pressSequentially('+380671234567', { delay: 30 });
  await stats('typing 13 chars in a field', t);

  await reset(); t = performance.now();
  await p.goto(`${APP}/reports/lists`, { waitUntil: 'networkidle' });
  await stats('lists Annex 5 (full load)', t);
  await b.close();
})();
