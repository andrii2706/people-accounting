import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { A11Y_STORAGE_KEY } from '../constants/a11y.constants';
import type { A11ySettings } from '../interfaces/a11y.interface';
import { a11yAttributes, a11yChanged, parseA11y } from '../utils/a11y.utils';

/**
 * «Доступність»: the choice of a person, kept in the browser under one key for the whole domain — the portal and
 * every module read the same value, so the text grows everywhere at once. Applied as attributes on <html>
 * (theme.css does the rest). A change in another tab or module comes in through the «storage» event.
 */
@Injectable({ providedIn: 'root' })
export class A11ySettingsService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<A11ySettings>(parseA11y(this.read()));

  readonly settings = this.state.asReadonly();
  /** how many settings differ from the default */
  readonly changed = computed(() => a11yChanged(this.state()));

  constructor() {
    this.apply(this.state());
    if (this.browser) {
      this.document.defaultView?.addEventListener('storage', (event) => {
        if (event.key !== A11Y_STORAGE_KEY) return;
        const next = parseA11y(event.newValue);
        this.state.set(next);
        this.apply(next);
      });
    }
  }

  set<K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) {
    const next = { ...this.state(), [key]: value };
    this.state.set(next);
    this.apply(next);
    this.write(next);
  }

  reset() {
    const next = parseA11y(null);
    this.state.set(next);
    this.apply(next);
    this.write(next);
  }

  private apply(settings: A11ySettings) {
    const root = this.document.documentElement;
    for (const [name, value] of Object.entries(a11yAttributes(settings))) {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
  }

  private read(): string | null {
    if (!this.browser) return null;
    try {
      return this.document.defaultView?.localStorage.getItem(A11Y_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private write(settings: A11ySettings) {
    if (!this.browser) return;
    try {
      this.document.defaultView?.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* private mode: the choice lives until the page is closed */
    }
  }
}
