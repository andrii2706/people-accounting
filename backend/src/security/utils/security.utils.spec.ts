import { describe, expect, it } from 'vitest';
import type { SecurityEvent } from '../entities/security-event.entity.js';
import { clientIp, deviceHash, deviceLabel, securityLetter } from './security.utils.js';

describe('deviceLabel', () => {
  it('names the browser and the system', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBe(
      'Chrome · Windows',
    );
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge · Windows');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1')).toBe(
      'Safari · iOS',
    );
    expect(deviceLabel('python-requests/2.31')).toBe('програма');
    expect(deviceLabel('')).toBe('браузер');
  });
});

describe('clientIp / deviceHash', () => {
  it('strips the IPv4-mapped prefix', () => {
    expect(clientIp({ ip: '::ffff:203.0.113.5' })).toBe('203.0.113.5');
    expect(clientIp({ ip: undefined })).toBe('');
  });

  it('the same device id gives a different hash for another account', () => {
    expect(deviceHash('a', 'd')).not.toBe(deviceHash('b', 'd'));
    expect(deviceHash('a', 'd')).toHaveLength(64);
  });
});

describe('securityLetter', () => {
  it('what, when, where and what to do — without empty lines in a row', () => {
    const letter = securityLetter(
      {
        kind: 'MFA_LOCKED',
        userName: 'Тестова Кадровичка',
        ip: '203.0.113.5',
        device: '',
        details: { failures: 5 },
        createdAt: new Date('2026-11-20T10:00:00Z'),
      } as unknown as SecurityEvent,
      'https://hr.example.ua/',
    );
    expect(letter.subject).toBe('Безпека: правильний пароль, але неправильні коди');
    expect(letter.text).toContain('Обліковий запис: Тестова Кадровичка');
    expect(letter.text).toContain('Адреса: 203.0.113.5');
    expect(letter.text).toContain('Невдалих спроб: 5');
    expect(letter.text).toContain('змініть його');
    expect(letter.text).toContain('https://hr.example.ua/settings/security');
    expect(letter.text).not.toContain('Пристрій');
    expect(letter.text).not.toMatch(/\n\n\n/);
  });
});
