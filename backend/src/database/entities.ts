import { PasswordResetToken } from '../users/password-reset-token.entity.js';
import { BillingStatusEntity } from '../billing/billing-status.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { InboxRead } from '../inbox/inbox-read.entity.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { EmployeeEducation } from '../employees/entities/employee-education.entity.js';
import { EmployeePosition } from '../employees/entities/employee-position.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { FamilyMember } from '../employees/entities/family-member.entity.js';
import { MilitaryDocument } from '../employees/entities/military-document.entity.js';
import { ChangeNotice } from '../letters/entities/change-notice.entity.js';
import { LetterSignature } from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import { NotificationLog } from '../notifications/notification-log.entity.js';
import { OrganizationHead } from '../organization/organization-head.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { ResponsiblePerson } from '../organization/responsible-person.entity.js';
import { User } from '../users/user.entity.js';
import { BillingSettings } from '../subscriptions/billing-settings.entity.js';
import { Invoice } from '../subscriptions/invoice.entity.js';
import { Subscription } from '../subscriptions/subscription.entity.js';
import { EntityDatabase } from '../entity-databases/entity-database.entity.js';
import { SignupRequest } from '../signup/signup-request.entity.js';
import { OfferSignature } from '../subscriptions/offer-signature.entity.js';

/** Explicit list of entities — no glob patterns, so it works correctly in ESM. */
export const ENTITIES = [
  User,
  Organization,
  OrganizationHead,
  ResponsiblePerson,
  Tck,
  Employee,
  FamilyMember,
  MilitaryDocument,
  EmployeePosition,
  EmployeeEducation,
  EmployeeChange,
  AuditLog,
  OutgoingLetter,
  LetterSignature,
  ChangeNotice,
  NotificationLog,
  InboxRead,
  BillingStatusEntity,
  LegalEntity,
  PasswordResetToken,
  BillingSettings,
  Subscription,
  Invoice,
  EntityDatabase,
  SignupRequest,
  OfferSignature,
];
