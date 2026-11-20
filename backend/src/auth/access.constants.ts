/**
 * What the portal shows on the tile of «Військовий облік» when it is closed — and where the user fixes it.
 * Paths are on the shared domain: /change-password is the portal's page, /oblik/… — pages of this module that
 * stay open for the payment and the offer.
 */
export const OBLIK_PATH = '/oblik/';

export const ACCESS_TEXT = {
  passwordExpired: 'Ваш пароль застарів — замініть його, щоб відкрити модуль.',
  passwordTemporary: 'Спершу замініть тимчасовий пароль — після цього модуль відкриється.',
  termsManager: 'Модуль недоступний — спершу підпишіть оферту КЕП.',
  termsStaff: 'Модуль недоступний — керівник компанії ще не підписав оферту. Зверніться до нього.',
  setupDirector: 'Спершу додайте свою юридичну особу — після цього модуль відкриється.',
  setupStaff: 'Обліковий запис ще не прив’язано до юридичної особи — зверніться до адміністратора компанії.',
  planManager: 'Модуль недоступний — оберіть тариф і зробіть оплату.',
  planStaff: 'Модуль недоступний — керівник ще не обрав тариф. Зверніться до нього.',
  expiredManager: 'Модуль недоступний — оплачений строк закінчився. Зробіть оплату рахунку.',
  expiredStaff: 'Модуль недоступний — оплачений строк закінчився. Зверніться до керівника щодо оплати.',
} as const;

export const ACCESS_ACTIONS = {
  changePassword: { label: 'Змінити пароль', path: '/change-password' },
  signTerms: { label: 'Підписати оферту', path: `${OBLIK_PATH}account/terms` },
  addEntity: { label: 'Додати юрособу', path: OBLIK_PATH },
  choosePlan: { label: 'Обрати тариф', path: `${OBLIK_PATH}account/plans` },
  pay: { label: 'Оплатити', path: `${OBLIK_PATH}account/subscription` },
} as const;
