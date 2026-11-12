import type { OfferDocumentInput } from '../../shared/interfaces/subscription.interface.js';

const KYIV = 'Europe/Kyiv';

/**
 * The document the head of the client signs with KEP: the full text of the offer (the version that is accepted)
 * and the statement of acceptance with the client's details. Plain UTF-8 text — any KEP program signs it,
 * and the signed file is readable without the app.
 */
export function buildOfferDocument(input: OfferDocumentInput): string {
  const { terms, entity } = input;
  const at = input.createdAt.toLocaleString('uk-UA', {
    timeZone: KYIV,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const offer = [
    terms.title,
    `Редакція від ${terms.version}`,
    '',
    terms.intro,
    '',
    ...terms.sections.flatMap((s) => [s.title, ...s.paragraphs, '']),
  ];
  return [
    ...offer,
    '────────────────────────────────────────',
    'ЗАЯВА ПРО ПРИЙНЯТТЯ (АКЦЕПТ) ПУБЛІЧНОЇ ОФЕРТИ',
    '',
    `Замовник: ${entity.fullName}`,
    `Код за ЄДРПОУ: ${entity.edrpou}`,
    entity.address ? `Місцезнаходження: ${entity.address}` : '',
    `В особі керівника: ${entity.headPosition} ${entity.headName}`.trim(),
    '',
    `Замовник приймає умови публічної оферти «${terms.title}» у редакції від ${terms.version}, ` +
      'викладені вище, без застережень. Договір вважається укладеним з моменту накладення ' +
      'кваліфікованого електронного підпису керівника на цю заяву.',
    '',
    `Номер заяви: ${input.id}`,
    `Сформовано: ${at} (Київ)`,
    '',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
}
