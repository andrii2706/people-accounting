import type { AccessLetterInput, MailLetter } from '../../shared/interfaces/mail.interface.js';
import {
  adminWho,
  esc,
  footerLine,
  kyivDateTime,
  letterHtml,
  PASSWORD_RULES_TEXT,
  securityHtml,
  securityText,
} from './letter-layout.js';

/**
 * The letter with a temporary password (access for the head / the responsible person, a user created or
 * reset by the administrator). Email-safe HTML in the common layout plus a plain-text part.
 */
export function accessLetter(input: AccessLetterInput): MailLetter {
  const hours = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 3_600_000));
  const until = kyivDateTime(input.expiresAt);
  const loginUrl = `${input.appUrl.replace(/\/+$/, '')}/login`;
  const host = input.appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const greeting = input.greetingName || input.fullName;
  const where = input.entityName ? ` ${input.entityName}` : '';
  const who = adminWho(input.adminName);
  const lead =
    input.kind === 'SIGNUP'
      ? 'Ви зареєструвалися в системі військового обліку. Після входу система попросить встановити власний пароль, ' +
        'ознайомитися з договором, внести відомості про вашу юридичну особу та обрати тариф. ' +
        'Перші 14 днів — пробний період без оплати.'
      : input.kind === 'RESET'
        ? `${who} скинув пароль до вашого облікового запису в системі військового обліку${where}.`
        : `${who} надав вам доступ до системи військового обліку${where}${input.asWhom ? ` як ${input.asWhom}` : ''}.`;
  const subject =
    input.kind === 'SIGNUP'
      ? 'Реєстрація в системі військового обліку'
      : input.kind === 'RESET'
        ? `Новий тимчасовий пароль — військовий облік${where}`
        : `Доступ до системи військового обліку${input.entityName ? ` — ${input.entityName}` : ''}`;
  const footer = footerLine(input.entityName, input.entityCode);
  const steps = [
    'Увійдіть з логіном і тимчасовим паролем.',
    `Система одразу попросить встановити власний пароль: ${PASSWORD_RULES_TEXT}.`,
    'Після цього тимчасовий пароль перестане діяти — цей лист можна видалити.',
  ];

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
    ...steps.map((s, i) => `  ${i + 1}. ${s}`),
    '',
    securityText(input.adminEmail),
    '',
    '—',
    'Лист надіслано автоматично, відповідати не потрібно.',
    footer,
  ].join('\n');

  const html = letterHtml({
    subject,
    entityName: input.entityName,
    greeting,
    paragraphs: [esc(lead), `Ваша роль: <b>${esc(input.roleLabel)}</b> — ${esc(input.roleHint)}.`],
    box: {
      title: 'Дані для входу',
      rows: [
        { label: 'Адреса', html: `<a href="${esc(input.appUrl)}" style="color:#4f5f37;">${esc(host)}</a>` },
        { label: 'Логін', html: esc(input.login) },
        {
          label: 'Тимчасовий пароль',
          html: esc(input.temporaryPassword),
          mono: true,
          note: `Діє до <b>${esc(until)}</b> (${hours} год.) — до першої зміни пароля.`,
        },
      ],
    },
    button: { label: 'Увійти в систему', url: loginUrl },
    steps,
    warning: securityHtml(input.adminEmail),
    footer: ['Лист надіслано автоматично з адреси для облікових записів — відповідати на нього не потрібно.', footer],
  });
  return { subject, text, html };
}
