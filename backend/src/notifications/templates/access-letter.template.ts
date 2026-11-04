import { formatUa } from '../../common/utils/dates.utils.js';
import type { AccessLetterInput, MailLetter } from '../../shared/interfaces/mail.interface.js';
import { ACCESS_LETTER_COLORS as C } from '../notifications.constants.js';

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** «07.11.2026, 22:06» in Kyiv time. */
function kyivDateTime(d: Date): string {
  const time = d.toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(d); // YYYY-MM-DD
  return `${formatUa(date)}, ${time}`;
}

/**
 * The letter with a temporary password (access for the head / the responsible person, a user created or
 * reset by the administrator). Email-safe HTML: tables and inline styles; plus a plain-text part.
 */
export function accessLetter(input: AccessLetterInput): MailLetter {
  const hours = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 3_600_000));
  const until = kyivDateTime(input.expiresAt);
  const company = input.entityName || 'Військовий облік';
  const loginUrl = `${input.appUrl.replace(/\/+$/, '')}/login`;
  const host = input.appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const greeting = input.greetingName || input.fullName;
  const where = input.entityName ? ` ${input.entityName}` : '';
  // «Адміністратор Андрій Зразковий»; an account simply named «Адміністратор» → «Адміністратор системи»
  const admin = input.adminName.trim();
  const who = !admin || /^адміністратор$/i.test(admin) ? 'Адміністратор системи' : `Адміністратор ${admin}`;
  const lead =
    input.kind === 'RESET'
      ? `${who} скинув пароль до вашого облікового запису в системі військового обліку${where}.`
      : `${who} надав вам доступ до системи військового обліку${where}` +
        `${input.asWhom ? ` як ${input.asWhom}` : ''}.`;
  const subject =
    input.kind === 'RESET'
      ? `Новий тимчасовий пароль — військовий облік${input.entityName ? ` ${input.entityName}` : ''}`
      : `Доступ до системи військового обліку${input.entityName ? ` — ${input.entityName}` : ''}`;
  const footer = [company, input.entityCode ? `ЄДРПОУ ${input.entityCode}` : ''].filter(Boolean).join(' · ');

  const text = [
    `Добрий день, ${greeting}!`,
    '',
    `${lead} Ваша роль: ${input.roleLabel}.`,
    '',
    'Дані для входу',
    `  Адреса:            ${input.appUrl}`,
    `  Логін:             ${input.login}`,
    `  Тимчасовий пароль: ${input.temporaryPassword}`,
    `  Діє до ${until} (${hours} год.) — до першої зміни пароля.`,
    '',
    'Що далі',
    '  1. Увійдіть з логіном і тимчасовим паролем.',
    '  2. Система попросить встановити власний пароль: щонайменше 12 символів, літери й цифри, без частини email.',
    '  3. Після цього тимчасовий пароль перестане діяти — цей лист можна видалити.',
    '',
    'Система містить персональні дані працівників. Не пересилайте цей лист і не повідомляйте пароль нікому.',
    `Якщо ви не очікували цього листа — зверніться до адміністратора: ${input.adminEmail}.`,
    '',
    '—',
    'Лист надіслано автоматично, відповідати не потрібно.',
    footer.startsWith('Військовий облік') ? footer : `Військовий облік · ${footer}`,
  ].join('\n');

  const label = (t: string) => `<div style="font-size:12px;color:${C.muted};">${t}</div>`;
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:16px 12px 40px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
<tr><td style="background:${C.brandDark};padding:22px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;background:${C.brand};border-radius:9px;text-align:center;vertical-align:middle;"><span style="font-size:13px;font-weight:700;line-height:36px;color:${C.brandLight};letter-spacing:.04em;">ВО</span></td>
    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:600;color:#ffffff;">Військовий облік</div>${input.entityName ? `<div style="font-size:12px;color:${C.brandSoft};">${esc(input.entityName)}</div>` : ''}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:30px 28px 8px;">
  <p style="margin:0 0 14px;font-size:20px;font-weight:600;line-height:1.3;">Добрий день, ${esc(greeting)}!</p>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${esc(lead)}</p>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">Ваша роль: <b>${esc(input.roleLabel)}</b> — ${esc(input.roleHint)}.</p>
</td></tr>
<tr><td style="padding:0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.brandPale};border:1px solid ${C.brandSoft};border-radius:12px;">
    <tr><td style="padding:18px 20px 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.brand};font-weight:600;">Дані для входу</td></tr>
    <tr><td style="padding:6px 20px;">${label('Адреса')}<div style="font-size:15px;"><a href="${esc(input.appUrl)}" style="color:${C.brand};">${esc(host)}</a></div></td></tr>
    <tr><td style="padding:6px 20px;">${label('Логін')}<div style="font-size:15px;">${esc(input.login)}</div></td></tr>
    <tr><td style="padding:6px 20px 18px;">${label('Тимчасовий пароль')}
      <div style="margin-top:4px;display:inline-block;background:#ffffff;border:1px solid ${C.line};border-radius:8px;padding:8px 14px;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:18px;letter-spacing:.08em;">${esc(input.temporaryPassword)}</div>
      <div style="margin-top:8px;font-size:13px;color:${C.warning};">Діє до <b>${esc(until)}</b> (${hours} год.) — до першої зміни пароля.</div>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 28px 8px;"><a href="${esc(loginUrl)}" style="display:inline-block;background:${C.brand};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">Увійти в систему</a></td></tr>
<tr><td style="padding:16px 28px 4px;">
  <p style="margin:0 0 8px;font-size:15px;font-weight:600;">Що далі</p>
  <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;">
    <li>Увійдіть з логіном і тимчасовим паролем.</li>
    <li>Система одразу попросить встановити власний пароль: щонайменше 12 символів, літери й цифри, без частини email.</li>
    <li>Після цього тимчасовий пароль перестане діяти — цей лист можна видалити.</li>
  </ol>
</td></tr>
<tr><td style="padding:20px 28px 26px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${C.warning};background:${C.warningPale};border-radius:0 8px 8px 0;"><tr><td style="padding:12px 16px;font-size:13px;line-height:1.6;">
    <b>Система містить персональні дані працівників.</b> Не пересилайте цей лист і не повідомляйте пароль нікому, зокрема «службі підтримки» — адміністратор ніколи його не запитує.
    Якщо ви не очікували цього листа, зверніться до адміністратора: <a href="mailto:${esc(input.adminEmail)}" style="color:${C.brand};">${esc(input.adminEmail)}</a>.
  </td></tr></table>
</td></tr>
<tr><td style="border-top:1px solid ${C.line};padding:16px 28px 22px;font-size:12px;line-height:1.6;color:${C.muted};">
  Лист надіслано автоматично з адреси для облікових записів — відповідати на нього не потрібно.<br>${esc(footer.startsWith('Військовий облік') ? footer : `Військовий облік · ${footer}`)}
</td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, text, html };
}
