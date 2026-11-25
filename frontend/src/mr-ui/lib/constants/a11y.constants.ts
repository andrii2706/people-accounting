import type { A11ySettings, A11ySwitch, A11yTextSize } from '../interfaces/a11y.interface';

/** One key for the whole domain: the portal and the modules live on one origin, so the choice is shared. */
export const A11Y_STORAGE_KEY = 'mr-a11y';

export const A11Y_DEFAULTS: A11ySettings = {
  text: 'md',
  contrast: false,
  motion: false,
  links: false,
  spacing: false,
  focus: false,
};

export const A11Y_TEXT_SIZES: readonly { value: A11yTextSize; label: string; px: number }[] = [
  { value: 'md', label: 'Звичайний', px: 15 },
  { value: 'lg', label: 'Більший', px: 17 },
  { value: 'xl', label: 'Найбільший', px: 19 },
];

export const A11Y_SWITCHES: readonly A11ySwitch[] = [
  {
    key: 'contrast',
    label: 'Високий контраст',
    hint: 'Біле тло замість сірого, темніші підписи, чіткіші сірі рамки.',
  },
  {
    key: 'motion',
    label: 'Менше руху',
    hint: 'Без анімацій і переливів; лоадери стоять. Вмикається й сам, якщо так налаштовано в системі.',
  },
  { key: 'links', label: 'Підкреслювати посилання', hint: 'Посилання видно не лише за кольором.' },
  {
    key: 'spacing',
    label: 'Ширші інтервали',
    hint: 'Рядки 1,5, між літерами й словами більше — легше читати.',
  },
  {
    key: 'focus',
    label: 'Помітніший фокус',
    hint: 'Товща рамка і світіння навколо елемента, з яким працює клавіатура.',
  },
];

/** The attributes on <html> the theme (theme.css) reacts to. */
export const A11Y_ATTRIBUTES: Record<keyof A11ySettings, string> = {
  text: 'data-a11y-text',
  contrast: 'data-a11y-contrast',
  motion: 'data-a11y-motion',
  links: 'data-a11y-links',
  spacing: 'data-a11y-spacing',
  focus: 'data-a11y-focus',
};

/** The page of the portal with the panel — the user menu of every module links here. */
export const A11Y_SETTINGS_URL = '/settings/accessibility';
