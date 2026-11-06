import type {
  MailLetter,
  PasswordChangeLetterInput,
  PasswordExpiringLetterInput,
} from '../../shared/interfaces/mail.interface.js';
import {
  adminWho,
  esc,
  footerLine,
  kyivDate,
  kyivDateTime,
  letterHtml,
  PASSWORD_RULES_TEXT,
  securityHtml,
  securityText,
} from './letter-layout.js';

const AUTO = 'Лист надіслано автоматично з адреси для облікових записів — відповідати на нього не потрібно.';

/**
 * Letter 1 — a reminder a month before: the password expires on a date; a button to set a new one now.
 * The current password keeps working until that date.
 */
export function passwordExpiringLetter(input: PasswordExpiringLetterInput): MailLetter {
  const greeting = input.greetingName || input.fullName;
  const date = kyivDate(input.expiresAt);
  const days = Math.max(0, Math.ceil((input.expiresAt.getTime() - Date.now()) / 86_400_000));
  const linkUntil = kyivDateTime(input.linkExpiresAt);
  const footer = footerLine(input.entityName, input.entityCode);
  const subject = `Пароль до військового обліку спливає ${date}`;
  const lead =
    `Пароль до вашого облікового запису (${input.login}) діє до ${date} — залишилось ${days} дн. ` +
    'Для тих, хто веде військовий облік, і для директорів паролі змінюються щопівроку.';
  const after = `Після ${date} система при вході попросить змінити пароль — без цього роботу продовжити не вийде.`;
  const steps = [
    'Натисніть «Змінити пароль» і двічі введіть новий пароль.',
    `Вимоги: ${PASSWORD_RULES_TEXT}; не такий, як поточний.`,
    'Після зміни всі інші сеанси завершаться — увійдіть знову з новим паролем.',
  ];

  const text = [
    `Добрий день, ${greeting}!`,
    '',
    lead,
    after,
    '',
    `Змінити пароль зараз: ${input.link}`,
    `  Посилання діє до ${linkUntil} і лише один раз. Пізніше змінити пароль можна в Профілі: ${input.appUrl}/profile`,
    '',
    'Як змінити',
    ...steps.map((s, i) => `  ${i + 1}. ${s}`),
    '',
    securityText(''),
    '',
    '—',
    AUTO,
    footer,
  ].join('\n');

  const html = letterHtml({
    subject,
    entityName: input.entityName,
    greeting,
    paragraphs: [esc(lead), esc(after)],
    box: {
      title: 'Ваш пароль',
      rows: [
        { label: 'Логін', html: esc(input.login) },
        { label: 'Діє до', html: `<b>${esc(date)}</b> (${days} дн.)` },
      ],
    },
    button: {
      label: 'Змінити пароль',
      url: input.link,
      note: `Посилання діє до ${esc(linkUntil)} і лише один раз. Пізніше — у Профілі системи.`,
    },
    stepsTitle: 'Як змінити',
    steps,
    warning: securityHtml(''),
    footer: [AUTO, footer],
  });
  return { subject, text, html };
}

/**
 * Letter 2 — the administrator asks to change the password: a link to set a new one;
 * until it is changed, the system lets the user only into the password change.
 */
export function passwordChangeLetter(input: PasswordChangeLetterInput): MailLetter {
  const greeting = input.greetingName || input.fullName;
  const linkUntil = kyivDateTime(input.linkExpiresAt);
  const footer = footerLine(input.entityName, input.entityCode);
  const subject = `Змініть пароль до військового обліку${input.entityName ? ` — ${input.entityName}` : ''}`;
  const lead = `${adminWho(input.adminName)} попросив вас змінити пароль до облікового запису ${input.login}.`;
  const after =
    'Поки пароль не змінено, система при вході відкриватиме лише сторінку зміни пароля. ' +
    'Поточний пароль для входу ще діє — новий можна задати за посиланням нижче або після входу.';
  const steps = [
    'Натисніть «Задати новий пароль» і двічі введіть новий пароль.',
    `Вимоги: ${PASSWORD_RULES_TEXT}; не такий, як поточний.`,
    'Після зміни всі сеанси завершаться — увійдіть з новим паролем.',
  ];

  const text = [
    `Добрий день, ${greeting}!`,
    '',
    lead,
    after,
    '',
    `Задати новий пароль: ${input.link}`,
    `  Посилання діє до ${linkUntil} і лише один раз.`,
    '',
    'Як змінити',
    ...steps.map((s, i) => `  ${i + 1}. ${s}`),
    '',
    securityText(input.adminEmail),
    '',
    '—',
    AUTO,
    footer,
  ].join('\n');

  const html = letterHtml({
    subject,
    entityName: input.entityName,
    greeting,
    paragraphs: [esc(lead), esc(after)],
    button: {
      label: 'Задати новий пароль',
      url: input.link,
      note: `Посилання діє до ${esc(linkUntil)} і лише один раз.`,
    },
    stepsTitle: 'Як змінити',
    steps,
    warning: securityHtml(input.adminEmail),
    footer: [AUTO, footer],
  });
  return { subject, text, html };
}
