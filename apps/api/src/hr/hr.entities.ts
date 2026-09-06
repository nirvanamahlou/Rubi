export interface Entity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Period {
  startsAt: string;
  endsAt: string;
}
/** Decimal stays a string at the boundary; the future database adapter must use Decimal. */
export interface Money {
  amount: string;
  currencyCode: string;
}
export type EmployeeStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';
export interface Employee extends Entity {
  personnelCode: string;
  firstNameFa: string;
  lastNameFa: string;
  latinName?: string;
  userId?: string;
  status: EmployeeStatus;
  startedAt: string;
  endedAt?: string;
  profileDocumentId?: string;
  countryId?: string;
  cityId?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
  skills: readonly string[];
  employmentHistory: readonly { title: string; period: Period }[];
}
/** Never include this object in list/error/audit DTOs. Encryption is a Phase B gate. */
export interface EmployeePrivateProfile {
  employeeId: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  bankReferenceId?: string;
  insuranceNumber?: string;
  medicalNote?: string;
  disciplinaryNote?: string;
}
export interface EmploymentAssignment extends Entity, Period {
  employeeId: string;
  branchId: string;
  organizationUnitId: string;
  positionId: string;
  managerEmployeeId?: string;
  substituteEmployeeId?: string;
  teamId?: string;
  cooperationType: 'PERMANENT' | 'FIXED_TERM' | 'PART_TIME' | 'CONSULTANT';
}
export interface OrganizationUnit extends Entity {
  name: string;
  branchId: string;
  parentId?: string;
  active: boolean;
}
export interface Position extends Entity {
  title: string;
  organizationUnitId: string;
  capacity: number;
  active: boolean;
}
export interface EmploymentContract extends Entity, Period {
  employeeId: string;
  number: string;
  issuerLegalEntityId: string;
  kind: string;
  probationEndsAt?: string;
  jobTitle: string;
  workplace: string;
  shiftId?: string;
  agreed: Money;
  benefits: readonly Money[];
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'ENDED' | 'CANCELLED';
  previousVersionId?: string;
  documentId?: string;
  makerUserId: string;
}
export interface Shift extends Entity {
  name: string;
  startMinute: number;
  endMinute: number;
  overnight: boolean;
  breakMinutes: number;
  timezone: string;
}
export interface AttendanceRecord extends Entity {
  employeeId: string;
  shiftId: string;
  checkedInAt: string;
  checkedOutAt?: string;
  source: 'MANUAL' | 'DEVICE';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  makerUserId: string;
}
export interface LeaveRequest extends Entity, Period {
  employeeId: string;
  requesterUserId: string;
  substituteEmployeeId?: string;
  kind: 'HOURLY' | 'DAILY' | 'MISSION';
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  attachmentDocumentId?: string;
}
export interface RecruitmentPosition extends Entity {
  positionId: string;
  requiredCount: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
}
export interface Candidate extends Entity {
  recruitmentPositionId: string;
  displayName: string;
  resumeDocumentId?: string;
  stage:
    'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'ACCEPTED' | 'REJECTED';
  interviewAt?: string;
  convertedEmployeeId?: string;
}
export interface OnboardingChecklist extends Entity {
  employeeId: string;
  kind: 'ONBOARDING' | 'OFFBOARDING';
  items: readonly {
    id: string;
    title: string;
    completedAt?: string;
    assignedUserId: string;
  }[];
}
export interface ReviewCriterion {
  id: string;
  weight: number;
  score: number;
}
export interface PerformanceReview extends Entity, Period {
  employeeId: string;
  managerEmployeeId: string;
  criteria: readonly ReviewCriterion[];
  selfAssessment?: string;
  managerAssessment?: string;
  improvementPlan?: string;
  status: 'DRAFT' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'FINAL';
  makerUserId: string;
}
export interface TrainingRecord extends Entity {
  employeeId: string;
  title: string;
  completedAt?: string;
  expiresAt?: string;
  certificateDocumentId?: string;
}
export interface EmployeeAsset extends Entity {
  employeeId: string;
  assetReference: string;
  deliveredAt: string;
  returnedAt?: string;
  receiptDocumentId?: string;
}
export interface HRReminder extends Entity {
  employeeId: string;
  dueAt: string;
  kind: 'CONTRACT' | 'CERTIFICATE' | 'DOCUMENT' | 'REVIEW';
  sourceId: string;
  completedAt?: string;
}
export interface CompensationProposal extends Entity {
  employeeId: string;
  kind: 'BENEFIT' | 'DEDUCTION';
  money: Money;
  makerUserId: string;
  status: 'DRAFT' | 'APPROVED';
}
/** HR owns retention intent, Documents owns file versions, access, scan and binary. */
export interface PersonnelDocument extends Entity {
  employeeId: string;
  documentId: string;
  classification: string;
  retentionPolicyId: string;
  legalHold: boolean;
}
export interface HrResources {
  employees: Employee;
  assignments: EmploymentAssignment;
  units: OrganizationUnit;
  positions: Position;
  contracts: EmploymentContract;
  shifts: Shift;
  attendance: AttendanceRecord;
  leave: LeaveRequest;
  vacancies: RecruitmentPosition;
  candidates: Candidate;
  onboarding: OnboardingChecklist;
  reviews: PerformanceReview;
  training: TrainingRecord;
  assets: EmployeeAsset;
  reminders: HRReminder;
  compensation: CompensationProposal;
  documents: PersonnelDocument;
}
