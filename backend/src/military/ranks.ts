/**
 * Довідник військових звань.
 * Перенесено з аркуша EDU_TCK (колонки M/N/O/Q) файлу new_military_list v8.6.
 * code 0 — призовник (звання немає).
 */
export type CompositionKey =
  | 'CONSCRIPT'
  | 'PRIVATE'
  | 'JUNIOR_NCO'
  | 'SENIOR_NCO'
  | 'HIGHER_NCO'
  | 'JUNIOR_OFFICER'
  | 'SENIOR_OFFICER'
  | 'HIGHER_OFFICER';

export interface RankDef {
  code: number;
  army: string;
  navy: string;
  /** Граничний вік перебування на військовому обліку (EDU_TCK!Q). */
  ageLimit: number;
  composition: CompositionKey;
}

export const RANKS: readonly RankDef[] = [
  { code: 0, army: 'призовник', navy: 'призовник', ageLimit: 60, composition: 'CONSCRIPT' },
  { code: 1, army: 'рекрут', navy: 'рекрут', ageLimit: 60, composition: 'PRIVATE' },
  { code: 2, army: 'солдат', navy: 'матрос', ageLimit: 60, composition: 'PRIVATE' },
  { code: 3, army: 'старший солдат', navy: 'старший матрос', ageLimit: 60, composition: 'PRIVATE' },
  { code: 4, army: 'молодший сержант', navy: 'старшина 2 статті', ageLimit: 60, composition: 'JUNIOR_NCO' },
  { code: 5, army: 'сержант', navy: 'старшина 1 статті', ageLimit: 60, composition: 'JUNIOR_NCO' },
  { code: 6, army: 'старший сержант', navy: 'головний старшина', ageLimit: 60, composition: 'SENIOR_NCO' },
  { code: 7, army: 'головний сержант', navy: 'головний корабельний старшина', ageLimit: 60, composition: 'SENIOR_NCO' },
  { code: 8, army: 'штаб-сержант', navy: 'штаб-старшина', ageLimit: 60, composition: 'SENIOR_NCO' },
  { code: 9, army: 'майстер-сержант', navy: 'майстер-старшина', ageLimit: 60, composition: 'HIGHER_NCO' },
  { code: 10, army: 'старший майстер-сержант', navy: 'старший майстер-старшина', ageLimit: 60, composition: 'HIGHER_NCO' },
  { code: 11, army: 'головний майстер-сержант', navy: 'головний майстер-старшина', ageLimit: 60, composition: 'HIGHER_NCO' },
  { code: 12, army: 'молодший лейтенант', navy: 'молодший лейтенант', ageLimit: 60, composition: 'JUNIOR_OFFICER' },
  { code: 13, army: 'лейтенант', navy: 'лейтенант', ageLimit: 60, composition: 'JUNIOR_OFFICER' },
  { code: 14, army: 'старший лейтенант', navy: 'старший лейтенант', ageLimit: 60, composition: 'JUNIOR_OFFICER' },
  { code: 15, army: 'капітан', navy: 'капітан-лейтенант', ageLimit: 60, composition: 'JUNIOR_OFFICER' },
  { code: 16, army: 'майор', navy: 'капітан 3 рангу', ageLimit: 60, composition: 'SENIOR_OFFICER' },
  { code: 17, army: 'підполковник', navy: 'капітан 2 рангу', ageLimit: 60, composition: 'SENIOR_OFFICER' },
  { code: 18, army: 'полковник', navy: 'капітан 1 рангу', ageLimit: 60, composition: 'SENIOR_OFFICER' },
  { code: 19, army: 'бригадний генерал', navy: 'комодор', ageLimit: 65, composition: 'HIGHER_OFFICER' },
  { code: 20, army: 'генерал-майор', navy: 'контр-адмірал', ageLimit: 65, composition: 'HIGHER_OFFICER' },
  { code: 21, army: 'генерал-лейтенант', navy: 'віце-адмірал', ageLimit: 65, composition: 'HIGHER_OFFICER' },
  { code: 22, army: 'генерал', navy: 'адмірал', ageLimit: 65, composition: 'HIGHER_OFFICER' },
];

export const COMPOSITION_LABELS: Record<CompositionKey, string> = {
  CONSCRIPT: 'призовник',
  PRIVATE: 'рядовий склад',
  JUNIOR_NCO: 'молодший сержантський і старшинський склад',
  SENIOR_NCO: 'старший сержантський і старшинський склад',
  HIGHER_NCO: 'вищий сержантський і старшинський склад',
  JUNIOR_OFFICER: 'молодший офіцерський склад',
  SENIOR_OFFICER: 'старший офіцерський склад',
  HIGHER_OFFICER: 'вищий офіцерський склад',
};

export const OFFICER_MIN_CODE = 12;

export function findRank(code: number | null | undefined): RankDef | undefined {
  if (code === null || code === undefined) return undefined;
  return RANKS.find((r) => r.code === code);
}

export function rankTitle(code: number | null | undefined, navy = false): string {
  const rank = findRank(code);
  if (!rank || rank.code === 0) return '';
  return navy ? rank.navy : rank.army;
}
