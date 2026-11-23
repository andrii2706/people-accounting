import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  it('answers the question of the window', async () => {
    const service = TestBed.inject(ConfirmService);
    const answer = service.confirm({
      title: 'Видалити?',
      confirmLabel: 'Видалити',
      tone: 'danger',
    });
    expect(service.request()?.confirm?.title).toBe('Видалити?');
    service.answer(true);
    await expect(answer).resolves.toBe(true);
    expect(service.request()).toBeNull();
  });

  it('a new question answers the old one with «no»', async () => {
    const service = TestBed.inject(ConfirmService);
    const first = service.confirm({ title: 'A?', confirmLabel: 'A' });
    const second = service.unsaved({ text: 'Зміни пропадуть' });
    await expect(first).resolves.toBe(false);
    service.answer('discard');
    await expect(second).resolves.toBe('discard');
  });
});
