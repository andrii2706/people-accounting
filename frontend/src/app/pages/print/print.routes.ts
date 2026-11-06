import type { Routes } from '@angular/router';
import { labelPrintResolver, printBackResolver } from './resolvers/print.resolvers';

/** Pages for printing from the browser: without the menu, the paper size comes from @page. */
export const PRINT_ROUTES: Routes = [
  {
    path: 'labels',
    title: 'Друк наклейок · Військовий облік',
    resolve: { data: labelPrintResolver, back: printBackResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./label-print/label-print.component').then((m) => m.LabelPrintComponent),
  },
];
