/** The size of the text a person chose: 15, 17 or 19 px at the root (rem follows). */
export type A11yTextSize = 'md' | 'lg' | 'xl';

/** «Доступність» — what a person turned on for himself; the same in every module of the domain. */
export interface A11ySettings {
  text: A11yTextSize;
  contrast: boolean;
  /** less movement; on by itself while the system asks for it (prefers-reduced-motion) */
  motion: boolean;
  links: boolean;
  spacing: boolean;
  focus: boolean;
}

/** One switch of the panel. */
export interface A11ySwitch {
  key: Exclude<keyof A11ySettings, 'text'>;
  label: string;
  hint: string;
}
