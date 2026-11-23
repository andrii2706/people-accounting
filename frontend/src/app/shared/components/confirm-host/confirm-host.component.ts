import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';
import { ModalComponent } from '../modal/modal.component';

/** The window of ConfirmService: once in the root of the application. */
@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  template: `
    @if (service.request(); as r) {
      @if (r.confirm; as c) {
        <app-modal
          [open]="true"
          [heading]="c.title"
          [tone]="c.tone ?? 'brand'"
          [icon]="
            c.icon ?? (c.tone === 'danger' ? 'trash' : c.tone === 'warning' ? 'alert' : 'info')
          "
          (closed)="service.answer(false)"
        >
          @if (c.text) {
            <p modal-lead class="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-muted">
              {{ c.text }}
            </p>
          }
          @if (c.typeToConfirm; as t) {
            <form class="pt-4" (submit)="$event.preventDefault(); ready() && service.answer(true)">
              <label class="label" for="confirm-typed">{{ t.label }}</label>
              <input
                id="confirm-typed"
                class="input font-mono"
                autocomplete="off"
                [value]="typed()"
                (input)="typed.set($any($event.target).value)"
              />
            </form>
          }
          <div modal-footer>
            <button
              type="button"
              class="btn btn-secondary cursor-pointer"
              (click)="service.answer(false)"
            >
              {{ c.cancelLabel ?? 'Скасувати' }}
            </button>
            <button
              type="button"
              class="btn cursor-pointer"
              [class]="c.tone === 'danger' ? 'btn-danger' : 'btn-primary'"
              [disabled]="!ready()"
              (click)="service.answer(true)"
            >
              {{ c.confirmLabel }}
            </button>
          </div>
        </app-modal>
      } @else if (r.unsaved; as u) {
        <app-modal
          [open]="true"
          [heading]="u.title ?? 'Зміни не збережено'"
          tone="warning"
          icon="alert"
          (closed)="service.answer('stay')"
        >
          <p modal-lead class="mt-1.5 text-sm leading-relaxed text-muted">{{ u.text }}</p>
          <div modal-footer>
            <button
              type="button"
              class="btn btn-ghost cursor-pointer text-danger sm:mr-auto"
              (click)="service.answer('discard')"
            >
              Не зберігати
            </button>
            <button
              type="button"
              class="btn btn-secondary cursor-pointer"
              (click)="service.answer('stay')"
            >
              Залишитися
            </button>
            @if (u.canSave !== false) {
              <button
                type="button"
                class="btn btn-primary cursor-pointer"
                (click)="service.answer('save')"
              >
                Зберегти
              </button>
            }
          </div>
        </app-modal>
      }
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly service = inject(ConfirmService);
  /** The text typed for typeToConfirm — empty again for every question. */
  protected readonly typed = linkedSignal({ source: this.service.request, computation: () => '' });
  protected readonly ready = computed(() => {
    const expected = this.service.request()?.confirm?.typeToConfirm?.value;
    return !expected || this.typed().trim() === expected.trim();
  });
}
