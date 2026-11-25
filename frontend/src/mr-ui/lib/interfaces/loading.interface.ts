/** A long action in progress: what the person sees over the page and hears from the screen reader. */
export interface LongActionState {
  label: string;
  hint: string;
}

/** The options of LongActionService.run(). */
export interface LongActionOptions {
  /** the second line under the label, e.g. «Не закривайте сторінку» */
  hint?: string;
  /** what is read out when the action is done (the snackbar is the app's own) */
  doneMessage?: string;
}
