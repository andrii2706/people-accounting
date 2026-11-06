import { inject } from '@angular/core';
import { RedirectCommand, type ResolveFn, Router } from '@angular/router';
import { of } from 'rxjs';
import type {
  LabelPrintData,
  LabelTestPrintState,
} from '../../../shared/interfaces/label-settings.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/**
 * Labels to print: of the letters in ?ids=…, or a test page from the label settings
 * (its unsaved settings come in the navigation state).
 */
export const labelPrintResolver: ResolveFn<LabelPrintData> = (route) => {
  const router = inject(Router);
  const ids = (route.queryParamMap.get('ids') ?? '').split(',').filter(Boolean);
  if (ids.length) return resolveOr(inject(LettersService).labelPrintData(ids), '/letters') as never;
  const state = router.currentNavigation()?.extras.state as
    Partial<LabelTestPrintState> | undefined;
  if (state?.labelTestPrint) return of({ groups: [state.labelTestPrint] });
  return new RedirectCommand(router.parseUrl('/letters'));
};

/** Where «Назад» leads: back to the settings after a test print, otherwise — the letters. */
export const printBackResolver: ResolveFn<string> = () => {
  const state = inject(Router).currentNavigation()?.extras.state as
    Partial<LabelTestPrintState> | undefined;
  return state?.back ?? '';
};
