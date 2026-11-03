import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_LENGTH, MESSAGE } from '../../military/employee-rules.js';
import type { MaxLengthField } from '../../shared/interfaces/employee.interface.js';

/** Optional string with a length limit, as in the DB column. */
export const EmployeeStr = (field: MaxLengthField) =>
  applyDecorators(
    IsOptional(),
    IsString({ message: 'Очікується текст' }),
    MaxLength(MAX_LENGTH[field], { message: MESSAGE.tooLong(MAX_LENGTH[field]) }),
  );

/** Passport type of the DTO (ID card by default). */
export const passportType = (dto: Record<string, unknown>) => (dto.passportType as string | undefined) ?? 'ID_CARD';

/** Rank code of the DTO. */
export const rankOf = (dto: Record<string, unknown>) => dto.rankCode as number | null | undefined;
