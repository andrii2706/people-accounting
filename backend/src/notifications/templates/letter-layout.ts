import { formatUa } from '../../common/utils/dates.utils.js';
import type { LetterLayout } from '../../shared/interfaces/mail.interface.js';
import { ACCESS_LETTER_COLORS as C } from '../notifications.constants.js';

/** HTML-escape a value that goes into a letter. */
export const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** «07.11.2026, 22:06» in Kyiv time. */
export function kyivDateTime(d: Date): string {
  const time = d.toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
  return `${kyivDate(d)}, ${time}`;
}

/** «07.11.2026» in Kyiv time. */
export function kyivDate(d: Date): string {
  return formatUa(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(d));
}

/** «Адміністратор Андрій Зразковий»; an account simply named «Адміністратор» → «Адміністратор системи». */
export function adminWho(name: string): string {
  const admin = name.trim();
  return !admin || /^адміністратор$/i.test(admin) ? 'Адміністратор системи' : `Адміністратор ${admin}`;
}

/**
 * The common look of the account letters (access, password reminders): email-safe HTML — tables
 * and inline styles, the app palette. `paragraphs`, `box.rows[].html`, `box.note`, `warning` are HTML
 * already escaped by the caller.
 */
export function letterHtml(l: LetterLayout): string {
  const label = (t: string) => `<div style="font-size:12px;color:${C.muted};">${esc(t)}</div>`;
  const box = l.box
    ? `<tr><td style="padding:0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.brandPale};border:1px solid ${C.brandSoft};border-radius:12px;">
    <tr><td style="padding:18px 20px 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.brand};font-weight:600;">${esc(l.box.title)}</td></tr>
    ${l.box.rows
      .map(
        (r, i) =>
          `<tr><td style="padding:6px 20px${i === l.box!.rows.length - 1 ? ' 18px' : ''};">${label(r.label)}${
            r.mono
              ? `<div style="margin-top:4px;display:inline-block;background:#ffffff;border:1px solid ${C.line};border-radius:8px;padding:8px 14px;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:18px;letter-spacing:.08em;">${r.html}</div>`
              : `<div style="font-size:15px;">${r.html}</div>`
          }${r.note ? `<div style="margin-top:8px;font-size:13px;color:${C.warning};">${r.note}</div>` : ''}</td></tr>`,
      )
      .join('\n    ')}
  </table>
</td></tr>`
    : '';
  const button = l.button
    ? `<tr><td style="padding:24px 28px 8px;"><a href="${esc(l.button.url)}" style="display:inline-block;background:${C.brand};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${esc(l.button.label)}</a>${
        l.button.note ? `<div style="margin-top:8px;font-size:12px;color:${C.muted};">${l.button.note}</div>` : ''
      }</td></tr>`
    : '';
  const steps = l.steps?.length
    ? `<tr><td style="padding:16px 28px 4px;">
  <p style="margin:0 0 8px;font-size:15px;font-weight:600;">${esc(l.stepsTitle ?? 'Що далі')}</p>
  <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;">${l.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
</td></tr>`
    : '';
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(l.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:16px 12px 40px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${C.ink};"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
<tr><td style="background:${C.brandDark};padding:22px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;background:${C.brand};border-radius:9px;text-align:center;vertical-align:middle;"><span style="font-size:13px;font-weight:700;line-height:36px;color:${C.brandLight};letter-spacing:.04em;">ВО</span></td>
    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:600;color:#ffffff;">Військовий облік</div>${l.entityName ? `<div style="font-size:12px;color:${C.brandSoft};">${esc(l.entityName)}</div>` : ''}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:30px 28px 8px;">
  <p style="margin:0 0 14px;font-size:20px;font-weight:600;line-height:1.3;">Добрий день, ${esc(l.greeting)}!</p>
  ${l.paragraphs.map((p, i) => `<p style="margin:0 0 ${i === l.paragraphs.length - 1 ? 22 : 14}px;font-size:15px;line-height:1.6;">${p}</p>`).join('\n  ')}
</td></tr>
${box}
${button}
${steps}
<tr><td style="padding:20px 28px 26px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${C.warning};background:${C.warningPale};border-radius:0 8px 8px 0;"><tr><td style="padding:12px 16px;font-size:13px;line-height:1.6;">${l.warning}</td></tr></table>
</td></tr>
<tr><td style="border-top:1px solid ${C.line};padding:16px 28px 22px;font-size:12px;line-height:1.6;color:${C.muted};">${l.footer.map(esc).join('<br>')}</td></tr>
</table></td></tr></table>
</body></html>`;
}

/** The last line of every account letter. */
export function footerLine(entityName: string, entityCode: string): string {
  return ['Військовий облік', entityName, entityCode ? `ЄДРПОУ ${entityCode}` : ''].filter(Boolean).join(' · ');
}

/** The security note shared by the letters; `adminEmail` — whom to ask. */
export function securityHtml(adminEmail: string): string {
  const contact = adminEmail
    ? ` Якщо ви не очікували цього листа, зверніться до адміністратора: <a href="mailto:${esc(adminEmail)}" style="color:${C.brand};">${esc(adminEmail)}</a>.`
    : ' Якщо ви не очікували цього листа, зверніться до адміністратора системи.';
  return `<b>Система містить персональні дані працівників.</b> Не пересилайте цей лист і не повідомляйте пароль нікому, зокрема «службі підтримки» — адміністратор ніколи його не запитує.${contact}`;
}

export function securityText(adminEmail: string): string {
  return (
    'Система містить персональні дані працівників. Не пересилайте цей лист і не повідомляйте пароль нікому.\n' +
    (adminEmail
      ? `Якщо ви не очікували цього листа — зверніться до адміністратора: ${adminEmail}.`
      : 'Якщо ви не очікували цього листа — зверніться до адміністратора системи.')
  );
}

/** Password rules repeated in the letters. */
export const PASSWORD_RULES_TEXT = 'щонайменше 12 символів, літери й цифри, без частини email';
