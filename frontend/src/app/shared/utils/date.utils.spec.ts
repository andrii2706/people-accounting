import { describe, expect, it } from 'vitest';
import { maskTimeInput } from './date.utils';
import { externalNoticeType } from './letter.utils';

describe('maskTimeInput', () => {
  it('puts the colon itself: the first two digits — hours, the next two — minutes', () => {
    expect(maskTimeInput('1')).toBe('1');
    expect(maskTimeInput('14')).toBe('14');
    expect(maskTimeInput('143')).toBe('14:3');
    expect(maskTimeInput('1430')).toBe('14:30');
    expect(maskTimeInput('14305')).toBe('14:30');
  });

  it('a first digit 3–9 is a one-digit hour; pasted separators are ignored', () => {
    expect(maskTimeInput('930')).toBe('09:30');
    expect(maskTimeInput('14.30')).toBe('14:30');
    expect(maskTimeInput('14 30')).toBe('14:30');
    expect(maskTimeInput('')).toBe('');
  });
});

describe('externalNoticeType', () => {
  it('hiring and dismissal are their own notices, the rest — a change of the data', () => {
    expect(externalNoticeType('HIRE')).toBe('HIRE');
    expect(externalNoticeType('DISMISSAL')).toBe('DISMISSAL');
    expect(externalNoticeType('LAST_NAME')).toBe('DATA');
  });
});
