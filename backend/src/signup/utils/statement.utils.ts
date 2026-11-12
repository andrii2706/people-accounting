import type { SignupStatementInput } from '../../shared/interfaces/signup.interface.js';

const KYIV = 'Europe/Kyiv';

/**
 * The statement the head of a company signs. It names the code, the e-mail and a unique number, so a signature
 * of one statement cannot be used for another sign-up. Plain UTF-8 text — any KEP program signs it.
 */
export function buildStatement(s: SignupStatementInput): string {
  const at = s.createdAt.toLocaleString('uk-UA', {
    timeZone: KYIV,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return [
    'ЗАЯВА',
    'про реєстрацію юридичної особи в застосунку «Військовий облік»',
    '',
    `Код за ЄДРПОУ: ${s.edrpou}`,
    `Робоча електронна пошта керівника: ${s.email}`,
    '',
    'Прошу зареєструвати юридичну особу з указаним кодом і надіслати тимчасовий пароль на вказану пошту.',
    'Підписуючи цю заяву кваліфікованим електронним підписом, підтверджую, що я є керівником цієї',
    'юридичної особи за даними Єдиного державного реєстру, і даю згоду на обробку моїх персональних',
    'даних для реєстрації та роботи в застосунку.',
    '',
    `Номер заяви: ${s.id}`,
    `Сформовано: ${at} (Київ)`,
    '',
  ].join('\n');
}
