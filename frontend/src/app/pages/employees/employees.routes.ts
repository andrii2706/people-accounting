import type { Routes } from '@angular/router';
import { editorGuard } from '../../shared/guards/auth.guard';
import { employeeListQueryKey } from '../../shared/utils/router.utils';
import { employeeCopyResolver } from './resolvers/employee-copy.resolver';
import { employeeDetailsResolver } from './resolvers/employee-details.resolver';
import { employeeListResolver } from './resolvers/employee-list.resolver';
import { employeeNoticesResolver } from './resolvers/employee-notices.resolver';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    title: 'Працівники · Військовий облік',
    resolve: { list: employeeListResolver },
    // the tabs «Потребують уваги / Відстрочка / Заброньовані» (?view=) filter the loaded list in the
    // browser — switching them must not download the whole list again
    runGuardsAndResolvers: (from, to) => employeeListQueryKey(from) !== employeeListQueryKey(to),
    loadComponent: () =>
      import('./employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
  },
  {
    path: 'new',
    canActivate: [editorGuard],
    title: 'Новий працівник · Військовий облік',
    resolve: { source: employeeCopyResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
  },
  {
    path: 'import',
    canActivate: [editorGuard],
    title: 'Імпорт працівників · Військовий облік',
    loadComponent: () =>
      import('./employee-import/employee-import.component').then((m) => m.EmployeeImportComponent),
  },
  {
    path: ':id',
    title: 'Картка працівника · Військовий облік',
    // the card and the notice history are independent requests — resolved in parallel
    resolve: { employee: employeeDetailsResolver, notices: employeeNoticesResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./employee-detail/employee-detail.component').then((m) => m.EmployeeDetailComponent),
  },
  {
    path: ':id/edit',
    canActivate: [editorGuard],
    title: 'Редагування · Військовий облік',
    resolve: { employee: employeeDetailsResolver },
    loadComponent: () =>
      import('./employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
  },
];
