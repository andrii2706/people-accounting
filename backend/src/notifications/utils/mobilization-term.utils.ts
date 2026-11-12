import { addDays } from '../../common/utils/dates.utils.js';
import type { IsoDate } from '../../shared/interfaces/common.interface.js';
import type {
  MobilizationState,
  MobilizationTerm,
  MobilizationUpdate,
} from '../../shared/interfaces/document.interface.js';
import { MOBILIZATION_EXTENSION_DAYS } from '../notifications.constants.js';

/**
 * Applies a check of the decrees to the saved term.
 *  - A decree with a later term than the confirmed one wins (and confirms an automatic estimate).
 *  - While the term has passed and no new decree is known, it is extended by 90 days
 *    (as every extension so far), marked «очікується указ» — until the decree appears.
 * `term` is null when the decrees could not be read.
 */
export function applyMobilizationCheck(
  state: MobilizationState,
  term: MobilizationTerm | null,
  today: IsoDate,
): MobilizationUpdate {
  let next = { ...state };
  let event: MobilizationUpdate['event'] = null;

  const confirmed = state.confirmedUntil ?? (state.estimated ? null : state.until);
  if (term && (!confirmed || term.until > confirmed)) {
    event = state.estimated && state.until === term.until ? 'confirmed' : 'decree';
    next = {
      until: term.until,
      confirmedUntil: term.until,
      decree: `Указ Президента України ${term.decree}`.trim(),
      estimated: false,
    };
  }

  if (next.until && next.until < today) {
    let until = next.until;
    while (until < today) until = addDays(until, MOBILIZATION_EXTENSION_DAYS);
    next = { ...next, until, estimated: true };
    event = 'estimated';
  }
  return { state: next, event };
}
