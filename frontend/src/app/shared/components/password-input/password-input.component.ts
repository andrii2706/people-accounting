import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Renderer2,
  signal,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * A password field with «show / hide»: wrap the input —
 * `<app-password-input><input class="input" type="password" … /></app-password-input>`.
 * The input stays the projected one (formField, autocomplete, the label of app-form-field keep working);
 * only its `type` changes. Hidden again on every new page (the component is created anew).
 */
@Component({
  selector: 'app-password-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'relative block' },
  template: `
    <ng-content />
    <button
      type="button"
      class="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted transition hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600"
      [attr.aria-label]="shown() ? 'Сховати пароль' : 'Показати пароль'"
      [attr.aria-pressed]="shown()"
      [title]="shown() ? 'Сховати пароль' : 'Показати пароль'"
      (mousedown)="$event.preventDefault()"
      (click)="shown.set(!shown())"
    >
      <app-icon [name]="shown() ? 'eyeOff' : 'eye'" />
    </button>
  `,
})
export class PasswordInputComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  protected readonly shown = signal(false);

  constructor() {
    effect(() => {
      const input = this.host.nativeElement.querySelector('input');
      if (!input) return;
      this.renderer.setAttribute(input, 'type', this.shown() ? 'text' : 'password');
      // room for the button, so the text does not run under it
      this.renderer.addClass(input, 'pr-11');
    });
  }
}
