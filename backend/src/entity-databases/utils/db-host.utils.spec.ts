import { describe, expect, it } from 'vitest';
import { HOST_PATTERN, isPrivateAddress, resolvePublicHost } from './db-host.utils.js';

describe('власна БД: адреса сервера', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.5',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.1.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
  ])('%s — внутрішня мережа', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '35.200.10.1', '2001:4860:4860::8888'])('%s — публічна', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it('метадані хмари й localhost відхиляються, якщо не дозволено явно', async () => {
    await expect(resolvePublicHost('169.254.169.254', false)).rejects.toThrow('внутрішню мережу');
    await expect(resolvePublicHost('127.0.0.1', false)).rejects.toThrow('внутрішню мережу');
    await expect(resolvePublicHost('127.0.0.1', true)).resolves.toBe('127.0.0.1');
    await expect(resolvePublicHost('8.8.8.8', false)).resolves.toBe('8.8.8.8');
  });

  it('формат адреси', () => {
    for (const ok of ['db.example.com', 'pg-1.company.ua', '35.200.10.1', 'localhost'])
      expect(HOST_PATTERN.test(ok)).toBe(true);
    for (const bad of ['http://db.example.com', 'db example', 'db.example.com/x', '-db.com', '']) {
      expect(HOST_PATTERN.test(bad)).toBe(false);
    }
  });
});
