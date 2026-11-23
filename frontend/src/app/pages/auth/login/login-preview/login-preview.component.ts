import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PREVIEW_NOTICE, PREVIEW_PEOPLE, PREVIEW_TONES } from './login-preview.constants';

/**
 * What the module looks like — the list of the personal record and a notice to the TCK, drawn in markup (no
 * screenshot), on the side of the sign-in page.
 */
@Component({
  selector: 'app-login-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    <div class="relative pb-16">
      <div
        class="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-sm"
      >
        <div class="mb-3 flex items-center gap-2 px-1">
          <span class="text-[13px] font-medium text-white/90">Персональний облік</span>
          <span class="ml-auto text-[11px] tracking-wide text-white/50 uppercase"
            >Військовозобов’язані · 37</span
          >
        </div>
        <div class="divide-y divide-line overflow-hidden rounded-xl bg-white text-ink shadow-sm">
          @for (p of people; track p.name) {
            <div class="flex items-center gap-3 px-3.5 py-2.5">
              <span
                class="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700"
              >
                {{ p.initials }}
              </span>
              <div class="min-w-0">
                <p class="truncate text-[12.5px] font-medium">{{ p.name }}</p>
                <p class="truncate text-[11px] text-muted">{{ p.rank }}</p>
              </div>
              <span
                class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                [class]="tones[p.state.tone]"
              >
                {{ p.state.text }}
              </span>
            </div>
          }
        </div>
      </div>
      <div
        class="absolute right-6 bottom-0 w-72 rounded-xl bg-white p-3.5 text-ink shadow-xl shadow-black/30 ring-1 ring-black/5"
      >
        <div class="flex items-center gap-2">
          <span class="grid size-6 place-items-center rounded-md bg-brand-100 text-brand-700">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4 4h16v16H4zM4 8l8 5 8-5" />
            </svg>
          </span>
          <span class="text-[12px] font-semibold whitespace-nowrap">{{ notice.title }}</span>
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
            [class]="tones['green']"
            >надіслано</span
          >
        </div>
        <p class="mt-2 text-[12px]">{{ notice.text }}</p>
        <p class="mt-0.5 text-[11px] text-muted tabular-nums">{{ notice.number }}</p>
      </div>
    </div>
  `,
})
export class LoginPreviewComponent {
  protected readonly people = PREVIEW_PEOPLE;
  protected readonly notice = PREVIEW_NOTICE;
  protected readonly tones = PREVIEW_TONES;
}
