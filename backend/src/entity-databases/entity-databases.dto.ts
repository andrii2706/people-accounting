import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Rule } from '../common/validators/validators.js';
import type { DbSslMode } from '../shared/interfaces/entity-database.interface.js';
import { DB_MIN_PORT, DB_SSL_MODES } from './entity-databases.constants.js';
import { HOST_PATTERN } from './utils/db-host.utils.js';

export class EntityDatabaseDto {
  @IsString()
  @MaxLength(255, { message: 'Не більше 255 символів' })
  @Rule((v: string) => HOST_PATTERN.test(v.trim()), 'Адреса сервера — ім’я (db.company.ua) або IP, без http:// і шляху')
  host: string;

  @IsInt({ message: 'Порт — ціле число' })
  @Min(DB_MIN_PORT, { message: `Порт — від ${DB_MIN_PORT}` })
  @Max(65535, { message: 'Порт — до 65535' })
  port: number;

  @IsString()
  @Rule((v: string) => /^[A-Za-z0-9_$-]{1,63}$/.test(v), 'Назва бази — латиниця, цифри, _ або -, до 63 символів')
  database: string;

  @IsString()
  @Rule((v: string) => /^[A-Za-z0-9_.@$-]{1,63}$/.test(v), 'Користувач — латиниця, цифри, _ . @ або -, до 63 символів')
  username: string;

  /** Empty — keep the saved password. */
  @IsOptional() @IsString() @MaxLength(200, { message: 'Не більше 200 символів' }) password?: string;

  @IsIn(DB_SSL_MODES, { message: 'Шифрування: require, verify-full або disable' }) sslMode: DbSslMode;
}
