import { Tck } from '../dictionaries/tck.entity.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { FamilyMember } from '../employees/entities/family-member.entity.js';
import { ChangeNotice } from '../letters/entities/change-notice.entity.js';
import { LetterSignature } from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { ResponsiblePerson } from '../organization/responsible-person.entity.js';
import { User } from '../users/user.entity.js';

/** Explicit list of entities — no glob patterns, so it works correctly in ESM. */
export const ENTITIES = [
  User,
  Organization,
  ResponsiblePerson,
  Tck,
  Employee,
  FamilyMember,
  EmployeeChange,
  AuditLog,
  OutgoingLetter,
  LetterSignature,
  ChangeNotice,
];
