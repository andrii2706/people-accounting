/**
 * Snapshot of everything printed in a change notice (Annex 4), taken when the letter is created.
 */
import type { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import type { Employee } from '../employees/entities/employee.entity.js';
import { actualAddressText, fullName, militaryDocText, rankText } from '../military/employee-format.js';

export interface NoticeSnapshot {
  lastName: string;
  firstName: string;
  middleName: string;
  gender: 'M' | 'F';
  birthDate: string | null;
  registryNumber: string;
  militaryDoc: string;
  vos: string;
  rank: string;
  conscript: boolean;
  tckName: string;
  registeredAddress: string;
  actualAddress: string;
  /** Item 7 — human-readable description of the change. */
  change: string;
  /** Item 8 — grounds for the change. */
  basis: string;
}

/** Item 7 of the notice: text of the change (the wording follows the Excel template). */
export function changeDescription(c: Pick<EmployeeChange, 'type' | 'newValue'>, gender: 'M' | 'F'): string {
  const ending = gender === 'F' ? 'а' : 'ий';
  switch (c.type) {
    case 'LAST_NAME':
      return `Зміна прізвища на ${c.newValue}`;
    case 'FIRST_NAME':
      return `Зміна власного імені на ${c.newValue}`;
    case 'MIDDLE_NAME':
      return `Зміна по батькові на ${c.newValue}`;
    case 'POSITION':
      return `Зміна посади. Переведен${ending} на посаду ${c.newValue}`;
    case 'REGISTERED_ADDRESS':
      return `Зміна зареєстрованого місця проживання: ${c.newValue}`;
    case 'ACTUAL_ADDRESS':
      return `Зміна фактичного місця проживання: ${c.newValue}`;
    case 'PASSPORT':
      return `Заміна внутрішнього паспорта: ${c.newValue}`;
    case 'FOREIGN_PASSPORT':
      return `Отримано закордонний паспорт: ${c.newValue}`;
    case 'EDUCATION':
      return `Здобуто освіту - ${c.newValue}`;
    case 'MARITAL_STATUS':
      return `Зміна сімейного стану. ${c.newValue}`;
    case 'REGISTRY_NUMBER':
      return `Зміна номера облікового запису в реєстрі: ${c.newValue}`;
    case 'RANK':
      return `Зміна військового звання: ${c.newValue || 'немає'}`;
    case 'VOS':
      return `Зміна військово-облікової спеціальності: ${c.newValue || 'немає'}`;
    case 'MILITARY_DOC':
      return `Зміна військово-облікового документа: ${c.newValue || 'немає'}`;
    case 'TCK':
      return `Взят${ending} на облік у ${c.newValue}`;
    case 'FITNESS':
      return `Зміна придатності до військової служби: ${c.newValue}`;
    case 'MILITARY_SERVICE':
      return `Відомості про проходження військової служби: ${c.newValue}`;
    case 'DEFERRAL':
      return c.newValue ? `Надано відстрочку: ${c.newValue}` : 'Відстрочку припинено';
    case 'RESERVATION':
      return c.newValue ? `Заброньован${ending === 'а' ? 'а' : 'ий'}: ${c.newValue}` : 'Бронювання припинено';
    case 'RESERVE_SERVICE':
      return c.newValue ? `Служба в резерві: ${c.newValue}` : 'Припинено службу в резерві';
    case 'MOBILIZATION_ORDER':
      return c.newValue ? `Вручено мобілізаційне розпорядження: ${c.newValue}` : 'Мобілізаційне розпорядження відсутнє';
    case 'DATA':
      return c.newValue;
    case 'HIRE':
      return `Прийняття на роботу. Прийнят${ending} на посаду ${c.newValue}`;
    case 'DISMISSAL':
      return 'Звільнення з роботи';
  }
}

/**
 * Snapshot for one notice. Hiring and dismissal are separate notices; all other changes of
 * the person are combined into one notice «зміна облікових даних» (several lines in item 7).
 */
export function noticeSnapshot(e: Employee, changes: Pick<EmployeeChange, 'type' | 'newValue' | 'basis'>[]): NoticeSnapshot {
  return {
    lastName: e.lastName,
    firstName: e.firstName,
    middleName: e.middleName,
    gender: e.gender,
    birthDate: e.birthDate,
    registryNumber: e.registryNumber ?? '',
    militaryDoc: militaryDocText(e),
    vos: e.vos ?? '',
    rank: rankText(e),
    conscript: e.rankCode === 0,
    tckName: e.tck?.name ?? '',
    registeredAddress: e.registeredAddress ?? '',
    actualAddress: actualAddressText(e) ?? '',
    change: changes.map((c) => changeDescription(c, e.gender)).join(';\n'),
    basis: [...new Set(changes.map((c) => c.basis?.trim()).filter(Boolean))].join('; '),
  };
}

export { fullName };
