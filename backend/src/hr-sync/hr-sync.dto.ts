import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Rule } from '../common/validators/validators.js';
import type {
  HrMilitaryPolicy,
  HrSyncFrequency,
  HrSyncMode,
  HrSystem,
} from '../shared/interfaces/hr-sync.interface.js';
import {
  HR_ALLOWED_IPS_MAX,
  HR_FREQUENCIES,
  HR_MILITARY_POLICIES,
  HR_MODES,
  HR_SYSTEMS,
  HR_TOKEN_VALID_DAYS,
} from './hr-sync.constants.js';
import { parseAllowedIps } from './utils/hr-push.utils.js';

const ipsProblem = (v: string) => {
  try {
    parseAllowedIps(v, HR_ALLOWED_IPS_MAX);
    return '';
  } catch (err) {
    return (err as Error).message;
  }
};

/** «Налаштування → Юрособа → 1С»: where the employees come from and what is done with them. */
export class HrSyncSettingsDto {
  @IsIn(HR_SYSTEMS, { message: 'Оберіть систему: ЗУП, Бухгалтерія або інша' }) system: HrSystem;

  @IsIn(HR_MODES, { message: 'Оберіть спосіб: 1С надсилає дані, ми читаємо OData або файл' }) mode: HrSyncMode;

  /** Once (initial load) or daily; missing — as before (daily), for older pages. */
  @IsOptional()
  @IsIn(HR_FREQUENCIES, { message: 'Оберіть: один раз або постійно' })
  frequency?: HrSyncFrequency;

  /** The address of the publication («https://1c.company.ua/zup»); required for ODATA. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Не більше 500 символів' })
  @Rule((v: string) => /^https?:\/\/[^\s/]+(\/\S*)?$/i.test(v.trim()), 'Адреса публікації — https://сервер/база')
  odataUrl?: string;

  @IsOptional() @IsString() @MaxLength(100, { message: 'Не більше 100 символів' }) odataUser?: string;

  /** Empty — keep the saved password. */
  @IsOptional() @IsString() @MaxLength(200, { message: 'Не більше 200 символів' }) odataPassword?: string;

  /** ЄДРПОУ of the organization in 1C (a base may keep several); empty — the code of the legal entity. */
  @IsOptional()
  @IsString()
  @Rule((v: string) => /^\d{8}(\d{2})?$/.test(v.trim()), 'Код ЄДРПОУ — 8 цифр (або 10 для ФОП)')
  organizationCode?: string;

  @IsBoolean() scheduleEnabled: boolean;

  @IsInt({ message: 'Година — ціле число' })
  @Min(0, { message: 'Година — від 0' })
  @Max(23, { message: 'Година — до 23' })
  scheduleHour: number;

  @IsBoolean() autoApply: boolean;

  @IsIn(HR_MILITARY_POLICIES, { message: 'Військові дані: заповнювати порожні, замінювати або не брати' })
  militaryPolicy: HrMilitaryPolicy;

  @IsBoolean() importDismissed: boolean;

  /** The addresses of the 1C server the key is accepted from («203.0.113.5, 198.51.100.0/24»); empty — any. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Не більше 500 символів' })
  @Rule((v: string) => !ipsProblem(v), (v: string) => ipsProblem(v))
  pushAllowedIps?: string;
}

/** A new key: how many days it works (0 — until revoked). */
export class HrIssueTokenDto {
  @IsOptional()
  @IsIn(HR_TOKEN_VALID_DAYS, { message: 'Строк ключа: 30, 90, 180, 365 днів або безстроково' })
  validDays?: number;
}
