import type { Routes } from '@angular/router';
import { listsReportResolver, operationalReportResolver } from './resolvers/report.resolvers';

/** Feature module "Reports": lists (Annex 5) and operational report (Annex 12). */
export const REPORTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'lists' },
  {
    path: 'lists',
    title: 'Списки персонального обліку · Військовий облік',
    resolve: { report: listsReportResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./lists/lists.component').then((m) => m.ListsComponent),
  },
  {
    path: 'operational',
    title: 'Відомість оперативного обліку · Військовий облік',
    resolve: { report: operationalReportResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./operational/operational.component').then((m) => m.OperationalComponent),
  },
];
