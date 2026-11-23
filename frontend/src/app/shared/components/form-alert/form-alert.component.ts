import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A message above the buttons of a form: an error (danger) or a state to know about (warning), with an icon. */
@Component({
  selector: 'app-form-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex gap-3 rounded-xl border px-3.5 py-3 text-sm leading-snug',
    '[class]':
      "tone() === 'warning' ? 'border-warning/25 bg-warning/5' : 'border-danger/20 bg-danger/5'",
    '[attr.role]': "tone() === 'warning' ? 'status' : 'alert'",
  },
  template: `
    <svg
      class="mt-px size-[18px] shrink-0"
      [class.text-warning]="tone() === 'warning'"
      [class.text-danger]="tone() !== 'warning'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @if (tone() === 'warning') {
        <path
          d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"
        />
      } @else {
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      }
    </svg>
    <div class="min-w-0">
      @if (heading()) {
        <p class="font-medium text-ink">{{ heading() }}</p>
      }
      <p [class.text-danger]="tone() !== 'warning'" [class.text-muted]="tone() === 'warning'">
        <ng-content />
      </p>
    </div>
  `,
})
export class FormAlertComponent {
  readonly tone = input<'danger' | 'warning'>('danger');
  readonly heading = input('');
}
