import type { EmployeeView } from '../interfaces/employee.interface';
import type { SelectOption } from '../interfaces/ui.interface';

/** Tabs of the employee list. */
export const EMPLOYEE_VIEWS: SelectOption<EmployeeView>[] = [
  { value: 'all', label: 'Працюють' },
  { value: 'attention', label: 'Потребують уваги' },
  { value: 'deferral', label: 'Відстрочка' },
  { value: 'reserved', label: 'Заброньовані' },
  { value: 'dismissed', label: 'Звільнені' },
];

/** Rows drawn at once in the employee table. */
export const EMPLOYEE_LIST_PAGE_SIZE = 100;

/** The contacts and addresses in «Історія контактів і адрес». */
export const CONTACT_HISTORY_LABELS: Record<string, string> = {
  phone: 'Телефон',
  email: 'Email',
  registeredAddress: 'Зареєстроване місце проживання',
  actualAddress: 'Фактичне місце проживання',
  passport: 'Паспорт',
};

/** Shown instead of an empty actual address: the registered one is taken in the notices and the lists. */
export const ACTUAL_AS_REGISTERED = 'як зареєстроване';
