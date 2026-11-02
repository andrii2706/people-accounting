import { UaDateTimePipe } from './ua-date-time.pipe';
import { UaDatePipe } from './ua-date.pipe';

describe('UaDatePipe', () => {
  const pipe = new UaDatePipe();

  it('ISO → ДД.ММ.РРРР без залежності від часового поясу', () => {
    expect(pipe.transform('2026-11-02')).toBe('02.11.2026');
    expect(pipe.transform('2026-11-02T23:30:00Z')).toBe('02.11.2026');
  });

  it('порожнє значення — прочерк або свій текст', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform('', 'не вказано')).toBe('не вказано');
  });
});

describe('UaDateTimePipe', () => {
  const pipe = new UaDateTimePipe();

  it('UTC з сервера показує за київським часом', () => {
    // 2 Nov is winter time in Kyiv (UTC+2)
    expect(pipe.transform('2026-11-02T08:15:00Z')).toBe('02.11.2026, 10:15');
  });

  it('некоректне або порожнє — прочерк', () => {
    expect(pipe.transform('not a date')).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
