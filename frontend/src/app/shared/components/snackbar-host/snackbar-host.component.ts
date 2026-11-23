import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Toast } from '../../interfaces/toast.interface';
import { ToastService } from '../../services/toast.service';

/**
 * The snackbars: white cards in the top right corner (on a phone — across the width at the top), the newest
 * nearest the corner. Esc
 * closes the newest unless a modal window is open (Esc is its «Скасувати» then).
 */
@Component({
  selector: 'app-snackbar-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-stretch gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:left-auto sm:w-[424px] sm:pt-6 sm:pr-6 sm:pl-0 print:hidden',
    '(document:keydown.escape)': 'closeNewest()',
  },
  template: `
    @for (t of toasts.toasts(); track t.id) {
      <div
        class="pointer-events-auto flex w-full items-center gap-3 rounded-[14px] border border-[#e4e3dc] bg-white py-2.5 pr-2 pl-4 text-[#1b1f17] shadow-[0_12px_32px_rgba(27,31,23,0.14)] motion-safe:animate-[snackbar-in_180ms_ease-out]"
        [attr.role]="t.kind === 'error' ? 'alert' : 'status'"
        (mouseenter)="toasts.pause(t.id)"
        (mouseleave)="toasts.resume(t.id)"
        (focusin)="toasts.pause(t.id)"
        (focusout)="toasts.resume(t.id)"
      >
        <span
          class="grid size-6 shrink-0 place-items-center rounded-full"
          [class]="dot(t)"
          aria-hidden="true"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            stroke-width="2.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            @switch (t.kind) {
              @case ('success') {
                <path d="m5 12 5 5L20 7" />
              }
              @case ('error') {
                <path d="M7 7l10 10M17 7 7 17" />
              }
              @case ('warning') {
                <path d="M12 7v6M12 17h.01" />
              }
              @default {
                <path d="M12 11v6M12 7h.01" />
              }
            }
          </svg>
        </span>
        <p class="min-w-0 flex-1 py-1 text-sm leading-snug whitespace-pre-line">{{ t.text }}</p>
        @if (t.action; as a) {
          @if (a.href) {
            <a
              [href]="a.href"
              class="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--snackbar-action,#4f5f37)] no-underline hover:bg-black/5"
              (click)="toasts.dismiss(t.id)"
              >{{ a.label }}</a
            >
          } @else {
            <button
              type="button"
              class="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold hover:bg-black/5"
              [class]="
                t.kind === 'error' ? 'text-[#b42318]' : 'text-[var(--snackbar-action,#4f5f37)]'
              "
              (click)="toasts.act(t)"
            >
              {{ a.label }}
            </button>
          }
        }
        @if (t.undo && t.duration) {
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            class="shrink-0 -rotate-90"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="9" fill="none" stroke="#e4e3dc" stroke-width="2" />
            <circle
              cx="11"
              cy="11"
              r="9"
              fill="none"
              stroke="var(--snackbar-action, #4f5f37)"
              stroke-width="2"
              stroke-dasharray="56.55"
              class="animate-[snackbar-ring_linear_forwards]"
              [style.animation-duration.ms]="t.duration"
              [style.animation-play-state]="t.paused ? 'paused' : 'running'"
            />
          </svg>
        } @else if (t.action || t.kind === 'error' || t.duration === null) {
          <button
            type="button"
            class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[#5d6356] hover:bg-black/5 hover:text-[#1b1f17]"
            aria-label="Закрити"
            (click)="toasts.dismiss(t.id)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        }
      </div>
    }
  `,
})
export class SnackbarHostComponent {
  protected readonly toasts = inject(ToastService);

  protected dot(t: Toast): string {
    return {
      success: 'bg-[#4f8a3c]',
      info: 'bg-[#3b6ea5]',
      warning: 'bg-[#c27a1a]',
      error: 'bg-[#c4321f]',
    }[t.kind];
  }

  protected closeNewest() {
    if (typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]')) return;
    const newest = this.toasts.toasts()[0];
    if (newest) this.toasts.dismiss(newest.id);
  }
}
