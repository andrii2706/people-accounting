import type { DutyCategory } from '../interfaces/dictionary.interface';
import type { InboxKind } from '../interfaces/inbox.interface';
import type { LetterStatus } from '../interfaces/letter.interface';
import type { SignatureVerification } from '../interfaces/signature.interface';
import type { BadgeStyle } from '../interfaces/ui.interface';

/** Badge of the registration category (військовозобов’язаний, резервіст, призовник). */
export const DUTY_CATEGORY_BADGES: Record<DutyCategory, BadgeStyle> = {
  LIABLE: { label: 'Військовозобов’язаний', cls: 'bg-brand-100 text-brand-700' },
  RESERVIST: { label: 'Резервіст', cls: 'bg-[#e6eef7] text-info' },
  CONSCRIPT: { label: 'Призовник', cls: 'bg-[#f6ecdf] text-warning' },
};

/** Badge of a letter status. */
export const LETTER_STATUS_BADGES: Record<LetterStatus, BadgeStyle> = {
  DRAFT: { label: 'Чернетка', cls: 'bg-sunken text-muted' },
  SENT: { label: 'Надіслано', cls: 'bg-[#e3f1e5] text-ok' },
};

/** Section titles of the notification list. */
export const INBOX_KIND_LABELS: Record<InboxKind, string> = {
  DEADLINE: 'Строки',
  TCK: 'Повідомлення ТЦК',
  CARD: 'Дані картки',
};

export const SIGNATURE_VERIFICATION_BADGES: Record<SignatureVerification, BadgeStyle> = {
  VALID: {
    label: 'Підпис дійсний',
    cls: 'bg-[#e3f1e5] text-ok',
    hint: 'Документ збігається, підпис перевірено криптографічно.',
  },
  DIGEST_MATCH: {
    label: 'Документ збігається',
    cls: 'bg-[#e8f0f8] text-info',
    hint: 'Підпис зроблено саме під цей документ. Підпис ДСТУ 4145 і статус сертифіката остаточно перевіряє сервіс ЦЗО.',
  },
  UNVERIFIED: {
    label: 'Не перевірено',
    cls: 'bg-[#fdf6ec] text-warning',
    hint: 'Алгоритм не підтримується сервером — перевірте підпис на сервісі ЦЗО.',
  },
};
