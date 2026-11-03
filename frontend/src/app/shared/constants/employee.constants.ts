import type { EmployeeView } from '../interfaces/employee.interface';
import type { SelectOption } from '../interfaces/ui.interface';

export const EMPLOYEE_VIEWS: SelectOption<EmployeeView>[] = [
  { value: 'all', label: 'Усі' },
  { value: 'attention', label: 'Потребують уваги' },
  { value: 'deferral', label: 'Відстрочка' },
  { value: 'reserved', label: 'Заброньовані' },
  { value: 'dismissed', label: 'Звільнені' },
];

/**
 * Employee list. Data comes from employeeListResolver; the search, group and category live in the URL
 * (a filtered list can be bookmarked). The tabs «Потребують уваги / Відстрочка / Заброньовані» filter
 * the loaded list in the browser; «Звільнені» asks the server for dismissed employees.
 */
/** Rows drawn at once in the employee table. */
export const EMPLOYEE_LIST_PAGE_SIZE = 100;

/** Allowed ?status= values of the employee list. */
export const EMPLOYEE_LIST_STATUSES = new Set(['active', 'dismissed', 'all']);
