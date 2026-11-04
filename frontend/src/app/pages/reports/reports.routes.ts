import type { Routes } from '@angular/router';
import {
  extractsResolver,
  listsReportResolver,
  operationalReportResolver,
} from './resolvers/report.resolvers';

/** Feature module "Reports": lists (Annex 5), extracts for the TCKs and operational report (Annex 12). */
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
    path: 'extracts',
    title: 'Витяги зі списків для ТЦК · Військовий облік',
    resolve: { extracts: extractsResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./extracts/extracts.component').then((m) => m.ExtractsComponent),
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
