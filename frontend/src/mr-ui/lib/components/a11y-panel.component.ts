import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { A11Y_SWITCHES, A11Y_TEXT_SIZES } from '../constants/a11y.constants';
import type { A11ySwitch, A11yTextSize } from '../interfaces/a11y.interface';
import { A11ySettingsService } from '../services/a11y-settings.service';
import { AnnouncerService } from '../services/announcer.service';

/**
 * «Доступність» — the panel of the settings a person turns on for himself. Every change is applied at once in every
 * module of the domain and read out to the screen reader. The size of the text is a radio group (APG: arrows move and
 * choose, one Tab stop); the rest are switches.
 */
@Component({
  selector: 'ui-a11y-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="overflow-hidden rounded-2xl border border-line bg-base-100">
      <div class="flex flex-wrap items-start gap-4 px-5 py-4">
        <div class="min-w-0 flex-1">
          <p id="ui-a11y-text" class="font-medium">Розмір тексту</p>
          <p class="mt-0.5 text-sm text-muted">
            Усе в застосунку стає більшим, нічого не обрізається (до 200 %).
          </p>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="ui-a11y-text"
          class="join"
          (keydown)="sizeKey($event)"
        >
          @for (s of sizes; track s.value) {
            <button
              #sizeButton
              type="button"
              role="radio"
              class="btn btn-sm join-item"
              [class.btn-primary]="s.value === a11y.settings().text"
              [class.btn-secondary]="s.value !== a11y.settings().text"
              [attr.aria-checked]="s.value === a11y.settings().text"
              [tabIndex]="s.value === a11y.settings().text ? 0 : -1"
              (click)="setSize(s.value)"
            >
              {{ s.label }}
            </button>
          }
        </div>
      </div>
      @for (item of switches; track item.key) {
        <label class="flex cursor-pointer items-start gap-4 border-t border-line px-5 py-4">
          <span class="min-w-0 flex-1">
            <span class="block font-medium">{{ item.label }}</span>
            <span class="mt-0.5 block text-sm text-muted" [id]="'ui-a11y-' + item.key">{{
              item.hint
            }}</span>
            @if (item.key === 'motion' && systemMotion()) {
              <span class="mt-1 block text-sm text-muted"
                >Система вже просить менше руху — анімацій немає й так.</span
              >
            }
          </span>
          <input
            type="checkbox"
            role="switch"
            class="toggle toggle-primary mt-0.5"
            [checked]="a11y.settings()[item.key]"
            [attr.aria-describedby]="'ui-a11y-' + item.key"
            (change)="toggle(item, $any($event.target).checked)"
          />
        </label>
      }
    </div>
    @if (a11y.changed()) {
      <button
        type="button"
        class="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink"
        (click)="reset()"
      >
        Повернути як було
      </button>
    }
  `,
})
export class UiA11yPanelComponent {
  protected readonly a11y = inject(A11ySettingsService);
  private readonly announcer = inject(AnnouncerService);
  private readonly document = inject(DOCUMENT);
  private readonly sizeButtons = viewChildren<ElementRef<HTMLButtonElement>>('sizeButton');

  protected readonly sizes = A11Y_TEXT_SIZES;
  protected readonly switches = A11Y_SWITCHES;
  protected readonly systemMotion = signal(
    !!this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  protected setSize(value: A11yTextSize) {
    this.a11y.set('text', value);
    this.announcer.polite(
      `Розмір тексту: ${this.sizes.find((s) => s.value === value)?.label.toLowerCase()}`,
    );
  }

  protected sizeKey(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const at = this.sizes.findIndex((s) => s.value === this.a11y.settings().text);
    const next = (at + step + this.sizes.length) % this.sizes.length;
    this.setSize(this.sizes[next].value);
    this.sizeButtons()[next]?.nativeElement.focus();
  }

  protected toggle(item: A11ySwitch, on: boolean) {
    this.a11y.set(item.key, on);
    this.announcer.polite(`${item.label}: ${on ? 'увімкнено' : 'вимкнено'}`);
  }

  protected reset() {
    this.a11y.reset();
    this.announcer.polite('Налаштування доступності скинуто');
  }
}
