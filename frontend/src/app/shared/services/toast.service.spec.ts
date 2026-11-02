import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('показує повідомлення і прибирає його через 4 с', () => {
    toast.success('Збережено');
    expect(toast.toasts()).toEqual([{ id: 1, kind: 'success', text: 'Збережено' }]);
    vi.advanceTimersByTime(4000);
    expect(toast.toasts()).toEqual([]);
  });

  it('помилку тримає довше (7 с), щоб її встигли прочитати', () => {
    toast.error('Не вдалося');
    vi.advanceTimersByTime(4000);
    expect(toast.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('закривається вручну', () => {
    toast.info('a');
    toast.info('b');
    toast.dismiss(toast.toasts()[0].id);
    expect(toast.toasts().map((t) => t.text)).toEqual(['b']);
  });
});
