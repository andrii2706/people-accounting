import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_PATHS } from '../constants/icons.constants';
import type { UiIconName } from '../interfaces/icon.interface';

/**
 * An icon of the set. Next to words it is decoration and hidden from screen readers; alone (a button «⋯», a status)
 * give it `label` — then it is an image with a name (WCAG 1.1.1). The colour is the colour of the text around.
 *
 *   <ui-icon name="download" />                       — beside «Завантажити»
 *   <button aria-label="Ще дії"><ui-icon name="more" /></button>
 *   <ui-icon name="alert" label="Прострочено" />       — the icon itself says something
 */
@Component({
  selector: 'ui-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class UiIconComponent {
  readonly name = input.required<UiIconName>();
  readonly size = input(18);
  readonly stroke = input(1.75);
  /** the name for screen readers when the icon stands alone */
  readonly label = input('');
  protected readonly path = computed(() => ICON_PATHS[this.name()]);
}
