import { BadRequestException } from '@nestjs/common';
import { isIsoDate, todayIso } from '../../common/utils/dates.utils.js';
import { LIST_GROUPS } from '../../military/dictionaries.js';
import type { ListGroup } from '../../shared/interfaces/dictionary.interface.js';

/** ?date= → ISO date (today by default). */
export function parseReportDate(value?: string) {
  if (!value) return todayIso();
  if (!isIsoDate(value)) throw new BadRequestException('date: очікується РРРР-ММ-ДД');
  return value;
}

/** ?groups=G1,G2 → list groups (all by default). */
export function parseListGroups(value?: string): ListGroup[] {
  if (!value) return LIST_GROUPS;
  const groups = value.split(',').map((g) => g.trim()) as ListGroup[];
  if (groups.some((g) => !LIST_GROUPS.includes(g))) throw new BadRequestException('Невідома група списку');
  return groups;
}
