import type { ChangeType } from '../interfaces/dictionary.interface';
import type { ExternalNoticeType } from '../interfaces/letter.interface';

/** What a notice about a queued change reports: hiring, dismissal, or a change of the registration data. */
export function externalNoticeType(type: ChangeType): ExternalNoticeType {
  return type === 'HIRE' ? 'HIRE' : type === 'DISMISSAL' ? 'DISMISSAL' : 'DATA';
}
