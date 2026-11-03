import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { HTTP_STATUS_MESSAGES } from '../constants/http.constants.js';
import { hasCyrillic } from '../utils/text.utils.js';

/**
 * Every error the API returns has a message a person can read. Messages written in Ukrainian
 * (validation, business rules) pass as they are; English defaults are replaced by the text for the status.
 * Other fields of the body (`errors` bound to fields, `code`, `rows`) are kept.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body: Record<string, unknown> =
      typeof raw === 'object' && raw !== null ? { ...(raw as Record<string, unknown>) } : { message: raw };
    const messages = Array.isArray(body['message']) ? body['message'] : [body['message']];
    if (!messages.some(hasCyrillic)) {
      body['message'] =
        HTTP_STATUS_MESSAGES[status] ??
        (status >= 500 ? 'Сервіс тимчасово недоступний — спробуйте пізніше' : 'Не вдалося виконати дію');
    }
    body['statusCode'] = status;
    res.status(status).json(body);
  }
}
