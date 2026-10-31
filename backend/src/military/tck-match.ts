/**
 * Matching a free-text TCK name (from a document: «Ким виданий ВОД», a column of 1C / Excel)
 * with the TCK directory. The same TCK is written in many ways:
 *   «Личаківсько-Залізничний ОР у місті Львові ТЦК та СП» = «Личаківсько-Залізничний ОРТЦК та СП (м. Львів)»
 *   «Шевченківський районний у місті Києві ТЦК та СП»     = «Шевченківський РТЦК та СП (м. Київ)»
 *   «І відділ Золочівського РТЦК та СП»                    = «І відділ Золочівського РТЦК та СП (м. Броди)»
 * Only an unambiguous match is returned; otherwise null (the field stays empty).
 * The file is identical in backend/src/military and frontend/src/app/shared/utils (keep them in sync).
 */

type Level = 'O' | 'R' | 'M';

interface ParsedTck {
  /** Stem of the distinguishing adjective: «шевченківськ», «личаківськ», «київськ». */
  adj: string | null;
  level: Level | null;
  /** Number of the «відділ» (department) or null for the TCK itself. */
  dept: number | null;
  /** Stem of the city: «льво», «киов». */
  city: string | null;
}

const ROMAN: Record<string, number> = { і: 1, іі: 2, ііі: 3, іv: 4, ів: 4, v: 5, в: 5 };

const LEVEL_WORDS: [RegExp, Level][] = [
  [/^(отцк|обласн\S*|овк)$/u, 'O'],
  [/^(мтцк|омтцк|міськ\S*|мвк)$/u, 'M'],
  [/^(ртцк|ортцк|ор|районн\S*|рвк|орвк)$/u, 'R'],
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’ʼ`'‘]/g, '')
    .replace(/[«»"().,:;№#*/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** «львові», «львова», «львів» → «льво»; «києві», «київ» → «киов» (і/ї/є/о alternation). */
function cityStem(word: string): string {
  return word.replace(/[іїєо]/g, 'о').slice(0, 4);
}

function adjStem(word: string): string | null {
  const stem = (w: string) => /^(.*(?:ськ|цьк|зьк))(?:ий|ого|ому|им|ій|ої|ою|а|е|и|і|о)?$/u.exec(w)?.[1] ?? null;
  // «амур-нижньодніпровський» — the whole word; «личаківсько-залізничний» — by its first part
  return stem(word) ?? (word.includes('-') ? stem(word.split('-')[0]) : null);
}

export function parseTckName(text: string): ParsedTck {
  const words = normalize(text).split(' ').filter(Boolean);
  let adj: string | null = null;
  let level: Level | null = null;
  let dept: number | null = null;
  let city: string | null = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    // department: «І відділ», «1 відділ», «відділ 1», «відділ № 2»
    if (/^відділ/u.test(w)) {
      const before = words[i - 1];
      const n = before && (ROMAN[before] ?? (/^\d+$/.test(before) ? Number(before) : undefined));
      const after = next && (ROMAN[next] ?? (/^\d+$/.test(next) ? Number(next) : undefined));
      dept = n || after || dept || 1;
      continue;
    }
    // city: «м. Львів», «у місті Львові», «міста Києва»
    if ((w === 'м' || w === 'місто' || w === 'місті' || w === 'міста' || w === 'смт' || w === 'селище') && next) {
      city = cityStem(next);
      i++;
      continue;
    }
    const lvl = LEVEL_WORDS.find(([re]) => re.test(w));
    if (lvl) {
      // «районний у місті Києві» is a district TCK, «обласний» — oblast
      level = level === 'O' ? 'O' : lvl[1];
      continue;
    }
    if (!adj) {
      const stem = adjStem(w);
      if (stem && stem.length >= 4) adj = stem;
    }
  }
  return { adj, level, dept, city };
}

export function matchTck<T extends { id: string; name: string }>(text: string | null | undefined, tcks: readonly T[]): string | null {
  const query = (text ?? '').trim();
  if (!query) return null;
  // exact name (case and punctuation aside)
  const key = normalize(query);
  const exact = tcks.find((t) => normalize(t.name) === key);
  if (exact) return exact.id;

  const q = parseTckName(query);
  if (!q.adj) return null;
  let candidates = tcks
    .map((t) => ({ t, p: parseTckName(t.name) }))
    .filter(({ p }) => p.adj === q.adj && p.dept === q.dept);
  if (q.level) {
    const sameLevel = candidates.filter(({ p }) => p.level === q.level || (q.level === 'R' && p.level === null));
    if (sameLevel.length) candidates = sameLevel;
  } else if (candidates.length > 1) {
    // no level in the text: a district TCK is far more common than the oblast one
    const notOblast = candidates.filter(({ p }) => p.level !== 'O');
    if (notOblast.length) candidates = notOblast;
  }
  if (candidates.length > 1 && q.city) {
    const sameCity = candidates.filter(({ p }) => p.city === q.city);
    if (sameCity.length) candidates = sameCity;
  }
  return candidates.length === 1 ? candidates[0].t.id : null;
}
