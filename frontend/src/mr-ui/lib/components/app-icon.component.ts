import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AppIconId } from '../interfaces/icon.interface';

/** The gradient of each tile: from the top to the bottom. */
const TILES: Record<AppIconId, [string, string]> = {
  portal: ['#3a4231', '#14180f'],
  oblik: ['#6f8350', '#3e4b2c'],
  kadry: ['#4c7fb0', '#24476a'],
  projects: ['#b1662b', '#6b3a15'],
};

let seq = 0;

/**
 * The icon of an application — the same as its tab in the browser (public/favicon.svg): a tile with a gradient and
 * a white sign. Decoration beside the name of the module; alone give it `label`.
 * From 20 px down the sign is simpler (no outline, no second-tier details) to stay sharp; `locked` —
 * the grey tile with a lock of a module that is closed or not connected.
 */
@Component({
  selector: 'ui-app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block shrink-0 leading-none',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" class="block">
      @if (locked()) {
        <rect width="32" height="32" rx="8" fill="#ecebe5" />
        <rect
          x="9.5"
          y="15"
          width="13"
          height="9.5"
          rx="2"
          fill="none"
          stroke="#5d6356"
          stroke-width="2"
        />
        <path
          d="M12.5 15v-3a3.5 3.5 0 0 1 7 0v3"
          fill="none"
          stroke="#5d6356"
          stroke-width="2"
          stroke-linecap="round"
        />
      } @else {
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" [attr.stop-color]="tile()[0]" />
            <stop offset="1" [attr.stop-color]="tile()[1]" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" [attr.fill]="'url(#' + gradientId + ')'" />
        @if (detailed()) {
          <rect
            x=".5"
            y=".5"
            width="31"
            height="31"
            rx="7.5"
            fill="none"
            stroke="#fff"
            stroke-opacity=".16"
          />
        }
        @switch (app()) {
          @case ('portal') {
            <rect x="6.5" y="6.5" width="8.5" height="8.5" rx="2.4" fill="#a9bb7f" />
            <rect x="17" y="6.5" width="8.5" height="8.5" rx="2.4" fill="#8fb5dc" />
            <rect x="6.5" y="17" width="8.5" height="8.5" rx="2.4" fill="#e0a06c" />
            <rect x="17" y="17" width="8.5" height="8.5" rx="2.4" fill="#fff" />
          }
          @case ('oblik') {
            <path
              d="M16 4.6l9.4 3.7v6.5c0 6.3-4.1 10.8-9.4 12.4-5.3-1.6-9.4-6.1-9.4-12.4V8.3z"
              fill="#fff"
            />
            @if (detailed()) {
              <path d="M16 4.6l9.4 3.7v6.5c0 6.3-4.1 10.8-9.4 12.4z" fill="#e2e8d3" />
              <path
                d="M10.8 14.2l5.2 3.6 5.2-3.6"
                fill="none"
                stroke="#4f5f37"
                stroke-width="2.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            }
          }
          @case ('kadry') {
            <circle cx="16" cy="11.6" r="5" fill="#fff" />
            <path d="M6.8 26.2c1-5.2 4.6-8.2 9.2-8.2s8.2 3 9.2 8.2z" fill="#fff" />
          }
          @default {
            @if (detailed()) {
              <rect x="5.5" y="6" width="6" height="20" rx="2" fill="#fff" fill-opacity=".22" />
              <rect x="13" y="6" width="6" height="20" rx="2" fill="#fff" fill-opacity=".22" />
              <rect x="20.5" y="6" width="6" height="20" rx="2" fill="#fff" fill-opacity=".22" />
            }
            <rect x="5.5" y="6" width="6" height="11" rx="2" fill="#fff" />
            <rect x="13" y="6" width="6" height="15.5" rx="2" fill="#fff" />
            <rect x="20.5" y="6" width="6" height="7.5" rx="2" fill="#fff" />
          }
        }
      }
    </svg>
  `,
})
export class UiAppIconComponent {
  /** portal, oblik, kadry, projects (any other id — the board of «Керування проєктами»). */
  readonly app = input.required<string>();
  readonly size = input(40);
  readonly locked = input(false);
  /** the name for screen readers when the tile stands alone (beside the name of the module — none) */
  readonly label = input('');

  /** Each icon its own gradient: one hidden on the page would take the colour of the others with it. */
  protected readonly gradientId = `ui-app-icon-${++seq}`;
  protected readonly tile = computed(() => TILES[this.app() as AppIconId] ?? TILES.projects);
  protected readonly detailed = computed(() => this.size() > 20);
}
