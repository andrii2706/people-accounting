import type { Routes } from '@angular/router';
import { letterDetailsResolver } from './resolvers/letter-details.resolver';
import { letterListResolver } from './resolvers/letter-list.resolver';
import { letterSigningResolver, signingConfigResolver } from './resolvers/letter-signing.resolver';

/** Feature module "Outgoing letters". */
export const LETTERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Вихідні листи · Військовий облік',
    resolve: { letters: letterListResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./letter-list/letter-list.component').then((m) => m.LetterListComponent),
  },
  {
    path: ':id',
    title: 'Лист · Військовий облік',
    // three independent requests run in parallel before the page opens
    resolve: {
      letter: letterDetailsResolver,
      signing: letterSigningResolver,
      signingConfig: signingConfigResolver,
    },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./letter-detail/letter-detail.component').then((m) => m.LetterDetailComponent),
  },
];
