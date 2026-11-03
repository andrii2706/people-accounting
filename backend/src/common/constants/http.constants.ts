import { HttpStatus } from '@nestjs/common';

/** Ukrainian text for errors raised without one (Nest defaults, body parser, throttler). */
export const HTTP_STATUS_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Некоректний запит — перевірте дані й спробуйте ще раз',
  [HttpStatus.UNAUTHORIZED]: 'Сеанс завершено — увійдіть знову',
  [HttpStatus.FORBIDDEN]: 'Недостатньо прав для цієї дії',
  [HttpStatus.NOT_FOUND]: 'Запис не знайдено — можливо, його вже видалили',
  [HttpStatus.CONFLICT]: 'Дані змінилися — оновіть сторінку й повторіть',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Завеликий обсяг даних — зменшіть файл або кількість рядків',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Непідтримуваний формат файлу',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Забагато спроб — зачекайте хвилину',
};
