import { formatUa, formatUaQuoted } from '../common/utils/dates.utils.js';
import type { Invoice } from '../subscriptions/invoice.entity.js';
import { amountInWords, money } from '../subscriptions/utils/amount-words.utils.js';
import { A4, empty, p, render, section, table, twoColumns } from './docx-kit.js';

/** Narrower margins than the official forms: an invoice is a business paper. */
const MARGINS = { top: 850, bottom: 850, left: 1134, right: 850 };
const W = A4.width - MARGINS.left - MARGINS.right;

/** «Постачальник» / «Платник» block: the label on the left, the requisites on the right. */
function party(label: string, lines: string[]) {
  return twoColumns(
    [p(label, { bold: true, size: 10 })],
    lines.filter(Boolean).map((line, i) => p(line, { size: 10, bold: i === 0 })),
    [1800, W - 1800],
  );
}

/**
 * «Рахунок на оплату» in the usual Ukrainian form: the supplier with the bank account, the payer, the number
 * and the date, a table of the services, the totals (with or without VAT), the amount in words, the term of
 * payment and the signature of who issued it.
 */
export async function buildInvoice(inv: Invoice): Promise<Buffer> {
  const s = inv.seller;
  const b = inv.buyer;
  const vat = s.vatPayer;
  const head = vat
    ? ['№', 'Товари (роботи, послуги)', 'Кіл-сть', 'Од.', 'Ціна без ПДВ', 'Сума без ПДВ']
    : ['№', 'Товари (роботи, послуги)', 'Кіл-сть', 'Од.', 'Ціна', 'Сума'];
  const widths = [450, W - 450 - 900 - 700 - 1400 - 1400, 900, 700, 1400, 1400];
  const totals: string[][] = vat
    ? [
        ['Разом без ПДВ:', money(inv.net)],
        ['ПДВ:', money(inv.vatAmount)],
        ['Всього з ПДВ:', money(inv.total)],
      ]
    : [
        ['Разом:', money(inv.total)],
        ['Без ПДВ', ''],
        ['Всього до сплати:', money(inv.total)],
      ];

  const children = [
    party('Постачальник', [
      s.name,
      `р/р ${s.iban}, у банку ${s.bank}`,
      `Код за ЄДРПОУ ${s.code}${s.ipn ? `, ІПН ${s.ipn}` : ''}`,
      [s.address, s.phone ? `тел. ${s.phone}` : '', s.email].filter(Boolean).join(', '),
      s.taxNote,
    ]),
    ...empty(),
    party('Платник', [
      b.name,
      b.code ? `Код за ЄДРПОУ ${b.code}` : '',
      [b.address, b.phone ? `тел. ${b.phone}` : ''].filter(Boolean).join(', '),
    ]),
    party('Замовлення', ['Без замовлення']),
    ...empty(),
    p(`Рахунок на оплату № ${inv.number}`, { bold: true, size: 14, align: 'center' }),
    p(`від ${formatUaQuoted(inv.issuedAt)}`, { size: 12, align: 'center', spacingAfter: 200 }),
    table(
      [head],
      [
        [
          { text: '1', align: 'center' },
          inv.description,
          { text: '1', align: 'center' },
          { text: 'посл.', align: 'center' },
          { text: money(inv.net), align: 'right' },
          { text: money(inv.net), align: 'right' },
        ],
      ],
      widths,
      { size: 10, headerSize: 10 },
    ),
    table(
      [],
      totals.map(([label, value]) => [
        { text: label, bold: true, align: 'right' },
        { text: value, bold: true, align: 'right' },
      ]),
      [W - 1400, 1400],
      { size: 10, borders: false },
    ),
    ...empty(),
    p(`Всього найменувань 1, на суму ${money(inv.total)} грн.`, { size: 10 }),
    p(amountInWords(inv.total), { size: 11, bold: true }),
    p(vat ? `У т.ч. ПДВ: ${amountInWords(inv.vatAmount)}` : 'Без ПДВ', { size: 10, spacingAfter: 200 }),
    p(`Рахунок дійсний до сплати до ${formatUa(inv.dueDate)}.`, { size: 10 }),
    p(
      `У призначенні платежу вкажіть: «Оплата за рахунком № ${inv.number} від ${formatUa(inv.issuedAt)}${vat ? `, у т.ч. ПДВ ${money(inv.vatAmount)} грн` : ', без ПДВ'}».`,
      { size: 10 },
    ),
    p('Доступ продовжується після надходження коштів на рахунок постачальника.', { size: 10, spacingAfter: 400 }),
    p(`Виписав(ла): ____________________ ${[s.signerPosition, s.signerName].filter(Boolean).join(' ')}`.trimEnd(), {
      size: 10,
    }),
  ];
  return render([section(children, false, MARGINS)], `Рахунок на оплату № ${inv.number}`);
}
