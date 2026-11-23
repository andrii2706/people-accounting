import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService (snackbars)', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('shows a message and takes it away in 4 s', () => {
    toast.success('Збережено');
    expect(toast.toasts()).toMatchObject([{ kind: 'success', text: 'Збережено', duration: 4000 }]);
    vi.advanceTimersByTime(4000);
    expect(toast.toasts()).toEqual([]);
  });

  it('an error stays until it is closed', () => {
    const id = toast.error('Не вдалося');
    vi.advanceTimersByTime(60_000);
    expect(toast.toasts()).toHaveLength(1);
    toast.dismiss(id);
    expect(toast.toasts()).toEqual([]);
  });

  it('newest first, at most three', () => {
    for (const t of ['a', 'b', 'c', 'd']) toast.info(t);
    expect(toast.toasts().map((t) => t.text)).toEqual(['d', 'c', 'b']);
  });

  it('the time stands while the pointer is over it', () => {
    const id = toast.success('a');
    vi.advanceTimersByTime(3000);
    toast.pause(id);
    vi.advanceTimersByTime(10_000);
    expect(toast.toasts()).toHaveLength(1);
    toast.resume(id);
    vi.advanceTimersByTime(1200);
    expect(toast.toasts()).toEqual([]);
  });

  it('«Скасувати» runs the step back and closes', () => {
    const undo = vi.fn();
    toast.undoable('Доступ вимкнено', undo);
    const [t] = toast.toasts();
    expect(t).toMatchObject({ undo: true, duration: 7000, action: { label: 'Скасувати' } });
    toast.act(t);
    expect(undo).toHaveBeenCalledOnce();
    expect(toast.toasts()).toEqual([]);
  });
});
