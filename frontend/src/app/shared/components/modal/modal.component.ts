import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ModalIcon, ModalTone } from '../../interfaces/confirm.interface';

let seq = 0;

/**
 * A modal window of the application (the native <dialog>: the page behind is out of reach, the focus stays inside,
 * Esc closes). The heading with a sign in the colour of the tone, the content, the buttons below
 * (`<div modal-footer>`). On a phone it comes up from the bottom across the width.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="app-modal"
      [class.app-modal-wide]="wide()"
      [attr.aria-labelledby]="headingId"
      (cancel)="$event.preventDefault(); closed.emit()"
      (click)="outside($event)"
    >
      <div class="app-modal-panel">
        <div class="flex items-start gap-3.5 px-5 pt-5 sm:px-6 sm:pt-6">
          @if (icon(); as i) {
            <span
              class="grid size-11 shrink-0 place-items-center rounded-xl"
              [class]="toneClass()"
              aria-hidden="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                @switch (i) {
                  @case ('trash') {
                    <path
                      d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                    />
                  }
                  @case ('alert') {
                    <path
                      d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
                    />
                  }
                  @case ('send') {
                    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
                  }
                  @case ('lock') {
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  }
                  @case ('user') {
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
                  }
                  @case ('building') {
                    <path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
                  }
                  @default {
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5M12 8h.01" />
                  }
                }
              </svg>
            </span>
          }
          <div class="min-w-0 flex-1 pt-0.5">
            <h2 [id]="headingId" class="text-[18px] leading-snug font-semibold text-balance">
              {{ heading() }}
            </h2>
            <ng-content select="[modal-lead]" />
          </div>
          <button
            type="button"
            class="-mt-1.5 -mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
            aria-label="Закрити"
            (click)="closed.emit()"
          >
            <svg
              width="18"
              height="18"
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
        </div>
        <div class="app-modal-body px-5 sm:px-6" [class.sm:pl-[82px]]="!!icon() && !wide()">
          <ng-content />
        </div>
        <div class="app-modal-footer">
          <ng-content select="[modal-footer]" />
        </div>
      </div>
    </dialog>
  `,
})
export class ModalComponent {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly tone = input<ModalTone>('brand');
  readonly icon = input<ModalIcon | null>(null);
  /** A form: wider, the content from the left edge. */
  readonly wide = input(false);
  /** Esc, the cross, a click outside. */
  readonly closed = output<void>();

  protected readonly headingId = `app-modal-${++seq}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected toneClass(): string {
    return {
      brand: 'bg-brand-100 text-brand-700',
      warning: 'bg-[#fdf3e6] text-warning',
      danger: 'bg-[#fbeceb] text-danger',
    }[this.tone()];
  }

  /** A click on the dim around the window (the dialog itself, not its panel). */
  protected outside(event: MouseEvent) {
    if (event.target === this.dialog().nativeElement) this.closed.emit();
  }
}
