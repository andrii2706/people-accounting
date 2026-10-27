import type { Routes } from '@angular/router';
import { employeeDetailsResolver } from './resolvers/employee-details.resolver';
import { employeeListResolver } from './resolvers/employee-list.resolver';
import { employeeNoticesResolver } from './resolvers/employee-notices.resolver';

/** Feature module "Employees": a separate lazy chunk with its own resolvers. */
export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    title: 'Працівники · Військовий облік',
    resolve: { list: employeeListResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
  },
  {
    path: 'new',
    title: 'Новий працівник · Військовий облік',
    loadComponent: () =>
      import('./employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
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
    title: 'Редагування · Військовий облік',
    resolve: { employee: employeeDetailsResolver },
    loadComponent: () =>
      import('./employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
  },
];
