import { A11Y_ATTRIBUTES, A11Y_DEFAULTS, A11Y_TEXT_SIZES } from '../constants/a11y.constants';
import type { A11ySettings } from '../interfaces/a11y.interface';

/** The settings from what was stored (any shape — an old version, a hand edit): unknown values fall back to the defaults. */
export function parseA11y(raw: string | null | undefined): A11ySettings {
  if (!raw) return { ...A11Y_DEFAULTS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...A11Y_DEFAULTS };
  }
  if (!data || typeof data !== 'object') return { ...A11Y_DEFAULTS };
  const value = data as Record<string, unknown>;
  const text = A11Y_TEXT_SIZES.some((s) => s.value === value['text'])
    ? (value['text'] as A11ySettings['text'])
    : 'md';
  const flag = (key: keyof A11ySettings) => value[key] === true;
  return {
    text,
    contrast: flag('contrast'),
    motion: flag('motion'),
    links: flag('links'),
    spacing: flag('spacing'),
    focus: flag('focus'),
  };
}

/** The attributes for <html>: only what differs from the default is set; the rest is removed. */
export function a11yAttributes(settings: A11ySettings): Record<string, string | null> {
  return {
    [A11Y_ATTRIBUTES.text]: settings.text === 'md' ? null : settings.text,
    [A11Y_ATTRIBUTES.contrast]: settings.contrast ? 'high' : null,
    [A11Y_ATTRIBUTES.motion]: settings.motion ? 'reduce' : null,
    [A11Y_ATTRIBUTES.links]: settings.links ? 'underline' : null,
    [A11Y_ATTRIBUTES.spacing]: settings.spacing ? 'wide' : null,
    [A11Y_ATTRIBUTES.focus]: settings.focus ? 'strong' : null,
  };
}

/** How many settings differ from the default — the hint in the user menu («Доступність · 2»). */
export function a11yChanged(settings: A11ySettings): number {
  return (Object.keys(A11Y_DEFAULTS) as (keyof A11ySettings)[]).filter(
    (k) => settings[k] !== A11Y_DEFAULTS[k],
  ).length;
}
