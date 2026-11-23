/** The colour of a modal window and of its main button: the action of the application, a warning, a removal. */
export type ModalTone = 'brand' | 'warning' | 'danger';

/** The sign in the corner of a modal window. */
export type ModalIcon = 'trash' | 'alert' | 'send' | 'lock' | 'info' | 'user' | 'building';

/** A question with two answers: do it or not. */
export interface ConfirmOptions {
  /** The question itself: «Видалити юрособу «…»?». */
  title: string;
  /** What follows, in plain words. */
  text?: string;
  /** The name of the action — never «OK»: «Видалити юрособу», «Позначити переданим». */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ModalTone;
  icon?: ModalIcon;
  /** For what cannot be undone: the button works once this text is typed (a code, a name). */
  typeToConfirm?: { label: string; value: string };
}

/** Changes that are not saved: keep them, drop them or stay. */
export interface UnsavedOptions {
  title?: string;
  text: string;
  /** No «Зберегти» when the page cannot save from here. */
  canSave?: boolean;
}

export type UnsavedChoice = 'save' | 'discard' | 'stay';

/** The question on the screen and the way back to the code that asked. */
export interface ConfirmRequest {
  kind: 'confirm' | 'unsaved';
  confirm?: ConfirmOptions;
  unsaved?: UnsavedOptions;
  resolve: (answer: boolean | UnsavedChoice) => void;
}
