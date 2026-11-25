import { formatUa } from '../../common/utils/dates.utils.js';
import type { MailLetter } from '../../shared/interfaces/mail.interface.js';
import type { QuotaLetterInput } from '../../shared/interfaces/legal-entity.interface.js';
import { esc, footerLine, letterHtml } from './letter-layout.js';

const arrow = (from: number | null, to: number | null) =>
  from !== null && from !== to ? `${from ?? '—'} → ${to ?? '—'}` : String(to ?? '—');

/**
 * The e-mail about the reservation quota of a legal entity: exceeded, fewer free places, the decision ends.
 * Only the numbers of the quota — the names of the employees stay in the system.
 */
export function quotaLetter(q: QuotaLetterInput): MailLetter {
  const over = q.quota !== null ? q.reservedCompany - q.quota : 0;
  const subject =
    q.kind === 'EXCEEDED'
      ? `${q.entityName}: квоту бронювання перевищено на ${over}`
      : q.kind === 'DECREASED'
        ? `${q.entityName}: вільних місць за квотою стало менше (${q.prevAvailable ?? '—'} → ${q.available ?? '—'})`
        : `${q.entityName}: рішення про квоту бронювання діє до ${q.validUntil ? formatUa(q.validUntil) : '—'}`;
  const lead =
    q.kind === 'EXPIRING'
      ? `Рішення, за яким підприємству надано квоту бронювання, діє до ${q.validUntil ? formatUa(q.validUntil) : '—'} включно. Після цього бронювати за квотою не можна — подайте документи на продовження заздалегідь.`
      : `${q.reason ? `${q.reason}. ` : ''}Система перерахувала квоту бронювання.`;
  const rows: [string, string][] = [
    ['База (військовозобов’язані чоловіки, що працюють)', arrow(q.prevBase, q.base)],
    [`Місць за квотою${q.percent !== null ? ` ${q.percent} %` : ''}`, String(q.quota ?? '—')],
    ['Заброньовано підприємством', String(q.reservedCompany)],
    q.kind === 'EXCEEDED' ? ['Перевищення', String(over)] : ['Вільних місць', arrow(q.prevAvailable, q.available)],
  ];
  const todo =
    q.kind === 'EXCEEDED'
      ? 'Перевірте, чи всі бронювання ще чинні, або подайте документи на збільшення квоти.'
      : q.kind === 'DECREASED'
        ? 'Нові бронювання за квотою — лише в межах вільних місць.'
        : 'Після продовження вкажіть нову дату в юрособі — система перерахує квоту.';
  const text = [
    'Добрий день!',
    '',
    lead,
    '',
    ...rows.map(([l, v]) => `${l}: ${v}`),
    '',
    todo,
    'Імен працівників у листі немає — список у системі.',
    '',
    `Відкрити квоту: ${q.url}`,
  ].join('\n');
  const html = letterHtml({
    subject,
    entityName: q.entityName,
    greeting: '',
    paragraphs: [esc(lead), esc(todo)],
    box: { title: 'Квота бронювання', rows: rows.map(([label, v]) => ({ label, html: esc(v) })) },
    button: { label: 'Відкрити квоту в системі', url: q.url },
    warning:
      '<b>Імен працівників у листі немає</b> — список заброньованих і перерахунки квоти дивіться в системі. Лист надіслано, бо ви отримуєте сповіщення про працівників цієї юрособи.',
    footer: [footerLine(q.entityName, q.entityCode)],
  });
  return { subject, text, html };
}
