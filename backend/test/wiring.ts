/**
 * The real services of the module wired on the in-memory database — for unit tests of the services that
 * build on them (letters, reports, notifications…). External effects (mail, storage, quota) are spies.
 */
import { vi } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { Tck } from '../src/dictionaries/tck.entity.js';
import { EmployeesService } from '../src/employees/employees.service.js';
import { AuditLog } from '../src/employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../src/employees/entities/employee-change.entity.js';
import { Employee } from '../src/employees/entities/employee.entity.js';
import { LegalEntitiesService } from '../src/legal-entities/legal-entities.service.js';
import { LegalEntity } from '../src/legal-entities/legal-entity.entity.js';
import { Organization } from '../src/organization/organization.entity.js';
import { OrganizationService } from '../src/organization/organization.service.js';
import { FakeDb } from './fake-db.js';
import { person } from './fixtures.js';

export function wire() {
  const db = new FakeDb();
  db.getRepository(Organization).seed({
    id: 1,
    alertDays: 30,
    notifyDeadlineDays: 7,
    mobilizationUntil: '2027-02-05',
  } as never);
  db.getRepository(LegalEntity).seed(
    {
      id: 'le1',
      fullName: 'Товариство з обмеженою відповідальністю «Вигадана компанія»',
      shortName: 'ТОВ «Вигадана компанія»',
      edrpou: '12345678',
      address: 'м. Тестове, вул. Уявна, 1',
      postalCode: '01001',
      letterNumberPrefix: 'ВО-',
      headPosition: 'Директор',
      headName: 'Вигаданий Директор Тестович',
      responsibleName: 'Відповідальна Тестова',
      responsiblePosition: 'Інспектор',
      responsiblePhone: '+380500000000',
      notifyEmails: 'hr@example.com, boss@example.com',
      reservationQuotaPercent: 50,
    } as never,
    {
      id: 'le2',
      fullName: 'ТОВ «Друга вигадана»',
      shortName: '',
      edrpou: '87654321',
      letterNumberPrefix: '',
      notifyEmails: '',
    } as never,
  );
  db.getRepository(Tck).seed(
    {
      id: 't1',
      name: 'Шевченківський РТЦК та СП',
      nameGenitive: 'Шевченківського РТЦК та СП',
      address: 'м. Тестове, вул. Військова, 5',
      postalCode: '01002',
      email: 'tck@example.com',
      isActive: true,
    } as never,
    {
      id: 't2',
      name: 'Франківський РТЦК та СП',
      nameGenitive: '',
      address: '',
      postalCode: '',
      email: '',
      isActive: true,
    } as never,
  );
  const org = new OrganizationService(db.getRepository(Organization) as never);
  const audit = new AuditService(db.getRepository(AuditLog) as never);
  const legalEntities = new LegalEntitiesService(
    db.getRepository(LegalEntity) as never,
    db.getRepository(Employee) as never,
    org,
  );
  const quota = { recalc: vi.fn() };
  const employees = new EmployeesService(
    db.getRepository(Employee) as never,
    db.getRepository(EmployeeChange) as never,
    db.getRepository(AuditLog) as never,
    db.dataSource as never,
    org,
    audit,
    legalEntities,
    undefined,
    quota as never,
  );
  const seedEmployee = (over: Record<string, unknown> = {}) =>
    db.getRepository<Employee>(Employee).seed(person(over) as never)[0];
  return { db, org, audit, legalEntities, employees, quota, seedEmployee };
}
