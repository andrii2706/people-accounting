import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Помилки PostgreSQL, які є помилками даних, а не сервера, — у зрозумілі 400/409 замість 500.
 * Остання лінія захисту: зазвичай такі дані відсіює валідація DTO.
 */
@Catch(QueryFailedError)
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(error: QueryFailedError & { driverError?: { code?: string; column?: string; detail?: string } }, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const code = error.driverError?.code;
    const map: Record<string, [number, string]> = {
      '22001': [HttpStatus.BAD_REQUEST, 'Задовге значення в одному з полів'],
      '22007': [HttpStatus.BAD_REQUEST, 'Некоректна дата'],
      '22008': [HttpStatus.BAD_REQUEST, 'Некоректна дата'],
      '22P02': [HttpStatus.BAD_REQUEST, 'Некоректний формат значення'],
      '23502': [HttpStatus.BAD_REQUEST, 'Не заповнено обов’язкове поле'],
      '23503': [HttpStatus.CONFLICT, 'Пов’язаний запис не знайдено або він використовується'],
      '23505': [HttpStatus.CONFLICT, 'Такий запис уже існує'],
    };
    const known = code ? map[code] : undefined;
    if (!known) {
      this.logger.error(error.message, error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Внутрішня помилка бази даних' });
      return;
    }
    const [status, message] = known;
    res.status(status).json({ statusCode: status, message });
  }
}
