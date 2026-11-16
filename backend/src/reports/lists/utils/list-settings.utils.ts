import { LIST_SECTIONS } from '../../../military/dictionaries.js';
import type { FieldError } from '../../../shared/interfaces/common.interface.js';
import type { ListSection } from '../../../shared/interfaces/dictionary.interface.js';
import type {
  ListSectionSettings,
  ListSettings,
  ListSigner,
} from '../../../shared/interfaces/list-settings.interface.js';
import {
  DEFAULT_LIST_SECTION,
  LIST_GROUPINGS,
  LIST_SORTS,
  MAX_LIST_SIGNERS,
  MAX_LIST_SUBTITLE,
  MAX_LIST_TITLE,
} from '../lists.constants.js';
import { visibleColumns } from './list-layout.utils.js';

/** The saved settings with the defaults for everything missing or broken (old data, a new column …). */
export function withListDefaults(saved: Partial<Record<ListSection, Partial<ListSectionSettings>>> | null | undefined) {
  const out = {} as ListSettings;
  for (const section of LIST_SECTIONS) {
    const s = saved?.[section] ?? {};
    out[section] = {
      columns: visibleColumns(Array.isArray(s.columns) && s.columns.length ? s.columns : DEFAULT_LIST_SECTION.columns),
      sort: LIST_SORTS.includes(s.sort!) ? s.sort! : DEFAULT_LIST_SECTION.sort,
      groupBy: LIST_GROUPINGS.includes(s.groupBy!) ? s.groupBy! : DEFAULT_LIST_SECTION.groupBy,
      title: typeof s.title === 'string' ? s.title : '',
      subtitle: typeof s.subtitle === 'string' ? s.subtitle : '',
      showOutgoing: typeof s.showOutgoing === 'boolean' ? s.showOutgoing : DEFAULT_LIST_SECTION.showOutgoing,
      signers: Array.isArray(s.signers) ? s.signers.slice(0, MAX_LIST_SIGNERS).map(cleanSigner) : [],
      template: s.template ?? null,
    };
  }
  return out;
}

const cleanSigner = (s: Partial<ListSigner>): ListSigner => ({
  position: (s.position ?? '').trim(),
  name: (s.name ?? '').trim(),
});

/** What is wrong with the settings of one list (field paths like «columns», «signers.1.name»). */
export function listSectionProblems(s: ListSectionSettings): FieldError[] {
  const problems: FieldError[] = [];
  if (visibleColumns(s.columns).length < 2)
    problems.push({ field: 'columns', message: 'Оберіть хоча б одну колонку, крім «№»' });
  if (s.title.length > MAX_LIST_TITLE)
    problems.push({ field: 'title', message: `Не більше ${MAX_LIST_TITLE} символів` });
  if (s.subtitle.length > MAX_LIST_SUBTITLE) {
    problems.push({ field: 'subtitle', message: `Не більше ${MAX_LIST_SUBTITLE} символів` });
  }
  if (s.signers.length > MAX_LIST_SIGNERS)
    problems.push({ field: 'signers', message: `Не більше ${MAX_LIST_SIGNERS} підписантів` });
  s.signers.forEach((signer, i) => {
    if (!signer.name) problems.push({ field: `signers.${i}.name`, message: 'Вкажіть ім’я та прізвище' });
    if (signer.position.length > 200 || signer.name.length > 200) {
      problems.push({ field: `signers.${i}.position`, message: 'Не більше 200 символів' });
    }
  });
  return problems;
}

/** The signers of a document: the chosen ones or the head of the legal entity. */
export function documentSigners(s: ListSectionSettings, headPosition: string, headName: string): ListSigner[] {
  return s.signers.length ? s.signers : [{ position: headPosition, name: headName }];
}
