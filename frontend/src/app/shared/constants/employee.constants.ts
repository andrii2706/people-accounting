import type { EmployeeView } from '../interfaces/employee.interface';
import type { SelectOption } from '../interfaces/ui.interface';

/** Tabs of the employee list. */
export const EMPLOYEE_VIEWS: SelectOption<EmployeeView>[] = [
  { value: 'all', label: 'Усі' },
  { value: 'attention', label: 'Потребують уваги' },
  { value: 'deferral', label: 'Відстрочка' },
  { value: 'reserved', label: 'Заброньовані' },
  { value: 'dismissed', label: 'Звільнені' },
];

/** Rows drawn at once in the employee table. */
export const EMPLOYEE_LIST_PAGE_SIZE = 100;
