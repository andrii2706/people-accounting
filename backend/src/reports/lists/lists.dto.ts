import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsIsoDate } from '../../common/validators/validators.js';
import type {
  ListColumnKey,
  ListGrouping,
  ListSectionSettings,
  ListSigner,
  ListSort,
} from '../../shared/interfaces/list-settings.interface.js';
import {
  LIST_COLUMN_KEYS,
  LIST_GROUPINGS,
  LIST_SORTS,
  MAX_LIST_SIGNERS,
  MAX_LIST_SUBTITLE,
  MAX_LIST_TITLE,
} from './lists.constants.js';

/** «Сформувати»: the lists of a legal entity on a date. */
export class CreateListSnapshotDto {
  @IsIsoDate() date: string;
  @IsOptional() @IsUUID('4', { message: 'Оберіть юридичну особу' }) legalEntityId?: string;
}

export class ListSignerDto implements ListSigner {
  @IsString() @MaxLength(200, { message: 'Не більше 200 символів' }) position: string;
  @IsString() @MaxLength(200, { message: 'Не більше 200 символів' }) name: string;
}

/** How one list looks (the Word template is uploaded separately). */
export class ListSectionSettingsDto implements Omit<ListSectionSettings, 'template'> {
  @IsArray()
  @ArrayMaxSize(LIST_COLUMN_KEYS.length)
  @IsIn(LIST_COLUMN_KEYS, { each: true, message: 'Невідома колонка' })
  columns: ListColumnKey[];

  @IsIn(LIST_SORTS, { message: 'Оберіть порядок' }) sort: ListSort;
  @IsIn(LIST_GROUPINGS, { message: 'Оберіть групування' }) groupBy: ListGrouping;
  @IsString() @MaxLength(MAX_LIST_TITLE, { message: `Не більше ${MAX_LIST_TITLE} символів` }) title: string;
  @IsString() @MaxLength(MAX_LIST_SUBTITLE, { message: `Не більше ${MAX_LIST_SUBTITLE} символів` }) subtitle: string;
  @IsBoolean() showOutgoing: boolean;

  @IsArray()
  @ArrayMaxSize(MAX_LIST_SIGNERS, { message: `Не більше ${MAX_LIST_SIGNERS} підписантів` })
  @ValidateNested({ each: true })
  @Type(() => ListSignerDto)
  signers: ListSignerDto[];
}
