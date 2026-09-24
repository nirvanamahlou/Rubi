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
  workedMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  calculationVersion: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  makerUserId: string;
}
export interface GeoPoint {
  /** Canonical signed decimal degrees; adapters must not convert through binary float. */
  latitude: string;
  longitude: string;
  accuracyMeters?: string;
}
export interface EmployeeCheckin extends Entity {
  employeeId: string;
  occurredAt: string;
  kind: 'IN' | 'OUT';
  source: 'MANUAL' | 'MOBILE' | 'BIOMETRIC' | 'IMPORT';
  shiftAssignmentId?: string;
  deviceReferenceId?: string;
  location?: GeoPoint;
  importBatchId?: string;
  makerUserId: string;
}
export interface AttendanceCorrection extends Entity {
  attendanceRecordId: string;
  requesterUserId: string;
  proposedCheckinAt?: string;
  proposedCheckoutAt?: string;
  reason: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
}
export interface AttendanceImportBatch extends Entity {
  sourceDocumentId: string;
  deviceReferenceId?: string;
  timezone: string;
  acceptedRows: number;
  rejectedRows: number;
  status: 'UPLOADED' | 'VALIDATED' | 'IMPORTED' | 'REJECTED';
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
export interface StaffingPlan extends Entity, Period {
  branchId: string;
  organizationUnitId: string;
  plannedHeadcount: number;
  approvedBudget?: Money;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'CLOSED';
  makerUserId: string;
}
export interface RecruitmentRequisition extends Entity {
  staffingPlanId?: string;
  positionId: string;
  requestedCount: number;
  reason: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  makerUserId: string;
}
export interface CandidateInterview extends Entity {
  candidateId: string;
  round: number;
  scheduledAt: string;
  panelUserIds: readonly string[];
  scores: readonly ReviewCriterion[];
  feedback?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  makerUserId: string;
}
export interface EmploymentOffer extends Entity, Period {
  candidateId: string;
  issuerLegalEntityId: string;
  proposedPay: Money;
  components: readonly Money[];
  documentId?: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'ACCEPTED' | 'DECLINED';
  makerUserId: string;
}
export interface EmployeeReferral extends Entity {
  candidateId: string;
  referrerEmployeeId: string;
  relationship: string;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
}
export interface EmploymentLifecycleEvent extends Entity {
  employeeId: string;
  kind: 'PROMOTION' | 'TRANSFER' | 'SEPARATION';
  effectiveAt: string;
  fromAssignmentId?: string;
  toAssignmentId?: string;
  reason: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'APPLIED' | 'CANCELLED';
  makerUserId: string;
}
export interface ExitInterview extends Entity {
  employeeId: string;
  separationEventId: string;
  conductedAt: string;
  interviewerUserId: string;
  feedback: string;
  documentId?: string;
}
/** HR prepares the settlement intent; Finance owns posting and payment. */
export interface FinalSettlementIntent extends Entity {
  employeeId: string;
  separationEventId: string;
  components: readonly {
    kind: 'PAYABLE' | 'DEDUCTION' | 'LEAVE_ENCASHMENT' | 'GRATUITY';
    money: Money;
  }[];
  financeReceiptId?: string;
  status: 'DRAFT' | 'APPROVED' | 'SUBMITTED_TO_FINANCE' | 'RECONCILED';
  makerUserId: string;
}
export interface ShiftAssignment extends Entity, Period {
  employeeId: string;
  shiftId: string;
  scheduleId?: string;
  recurrenceRule?: string;
  status: 'REQUESTED' | 'APPROVED' | 'ACTIVE' | 'CANCELLED';
  makerUserId: string;
}
export interface ShiftRequest extends Entity, Period {
  employeeId: string;
  requestedShiftId: string;
  kind: 'ASSIGN' | 'CHANGE' | 'SWAP';
  swapWithEmployeeId?: string;
  recurrenceRule?: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  requesterUserId: string;
}
export interface LeaveType extends Entity {
  title: string;
  unit: 'HOUR' | 'DAY';
  compensatory: boolean;
  paid: boolean;
  active: boolean;
}
export interface LeavePolicy extends Entity, Period {
  branchId: string;
  leaveTypeId: string;
  allocationUnits: string;
  carryForward: boolean;
  encashmentAllowed: boolean;
  holidayListId: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export interface HolidayList extends Entity, Period {
  branchId: string;
  title: string;
  holidays: readonly { occurredAt: string; title: string }[];
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export interface LeaveLedgerEntry extends Entity {
  employeeId: string;
  leaveTypeId: string;
  occurredAt: string;
  units: string;
  direction: 'CREDIT' | 'DEBIT' | 'RESERVE' | 'RELEASE';
  sourceId: string;
  status: 'PENDING' | 'POSTED' | 'REVERSED';
}
export interface EmployeeExpense extends Entity {
  employeeId: string;
  kind: 'TRAVEL_REQUEST' | 'ADVANCE' | 'EXPENSE_CLAIM';
  money: Money;
  exchangeRate?: string;
  settlementMoney?: Money;
  documentId?: string;
  approvalStage: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECONCILED';
  makerUserId: string;
}
export interface TrainingProgram extends Entity {
  title: string;
  skillIds: readonly string[];
  providerReferenceId?: string;
  active: boolean;
}
export interface TrainingEvent extends Entity, Period {
  programId: string;
  participantEmployeeIds: readonly string[];
  trainerReferenceId?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}
export interface TrainingOutcome extends Entity {
  eventId: string;
  employeeId: string;
  result: 'PASSED' | 'FAILED' | 'INCOMPLETE';
  score?: number;
  feedback?: string;
  certificateDocumentId?: string;
}
export interface PerformanceCycle extends Entity, Period {
  title: string;
  branchId: string;
  selfReviewEnabled: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
}
export interface PerformanceGoal extends Entity, Period {
  employeeId: string;
  cycleId: string;
  parentGoalId?: string;
  title: string;
  keyResult: string;
  weight: number;
  progress: number;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}
export interface SalaryComponent extends Entity, Period {
  title: string;
  kind: 'EARNING' | 'DEDUCTION';
  formulaExpression?: string;
  taxable: boolean;
  currencyCode: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export interface SalaryStructure extends Entity, Period {
  title: string;
  issuerLegalEntityId: string;
  componentIds: readonly string[];
  currencyCode: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export interface AdditionalPayment extends Entity {
  employeeId: string;
  componentId: string;
  kind: 'ADDITIONAL' | 'BONUS' | 'INCENTIVE' | 'ARREAR' | 'CORRECTION';
  money: Money;
  effectiveAt: string;
  payrollRunId?: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED' | 'CANCELLED';
  makerUserId: string;
}
export interface PayrollRun extends Entity, Period {
  issuerLegalEntityId: string;
  employeeIds: readonly string[];
  formulaVersion: string;
  totals: readonly Money[];
  status:
    'DRAFT' | 'CALCULATED' | 'APPROVED' | 'SUBMITTED_TO_FINANCE' | 'RECONCILED';
  makerUserId: string;
}
export interface SalarySlip extends Entity {
  payrollRunId: string;
  employeeId: string;
  components: readonly {
    componentId: string;
    kind: 'EARNING' | 'DEDUCTION';
    money: Money;
  }[];
  net: Money;
  documentId?: string;
  status: 'DRAFT' | 'FINAL';
}
export interface TaxBenefitRule extends Entity, Period {
  kind: 'TAX_SLAB' | 'EXEMPTION' | 'BENEFIT' | 'GRATUITY';
  issuerLegalEntityId: string;
  brackets: readonly { from: Money; to?: Money; rate: string }[];
  authorityDocumentId: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export interface EmployeeLoan extends Entity, Period {
  employeeId: string;
  principal: Money;
  installment: Money;
  status: 'REQUESTED' | 'APPROVED' | 'ACTIVE' | 'SETTLED' | 'REJECTED';
  makerUserId: string;
}
export interface TaxDeclaration extends Entity, Period {
  employeeId: string;
  taxRuleId: string;
  declaredMoney?: Money;
  proofDocumentIds: readonly string[];
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  makerUserId: string;
}
export interface BenefitEnrollment extends Entity, Period {
  employeeId: string;
  benefitRuleId: string;
  employeeContribution?: Money;
  employerContribution?: Money;
  status: 'REQUESTED' | 'APPROVED' | 'ACTIVE' | 'ENDED' | 'REJECTED';
}
export interface Vehicle extends Entity {
  assetReferenceId: string;
  registrationReferenceId: string;
  branchId: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
}
export interface VehicleLog extends Entity, Period {
  vehicleId: string;
  employeeId: string;
  purpose: string;
  startOdometer: string;
  endOdometer?: string;
  expense?: Money;
  status: 'RESERVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}
export interface HrWorkflowDefinition extends Entity {
  resource: string;
  branchId: string;
  stages: readonly {
    key: string;
    permission: string;
    slaMinutes?: number;
  }[];
  active: boolean;
}
export interface HrIntegrationSubscription extends Entity {
  eventType: string;
  consumerId: string;
  endpointReferenceId: string;
  signingKeyReferenceId: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
}
export interface HrNotificationRule extends Entity {
  eventType: string;
  branchId: string;
  channel: 'IN_APP' | 'EMAIL' | 'PUSH';
  templateReferenceId: string;
  reminderMinutes?: number;
  active: boolean;
}
export interface HrCustomizationDefinition extends Entity {
  resource: string;
  branchId: string;
  kind: 'FIELD' | 'FORM' | 'PRINT_TEMPLATE' | 'REPORT';
  schemaDocumentId: string;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
}
export interface HrResources {
  employees: Employee;
  assignments: EmploymentAssignment;
  units: OrganizationUnit;
  positions: Position;
  contracts: EmploymentContract;
  shifts: Shift;
  attendance: AttendanceRecord;
  checkins: EmployeeCheckin;
  attendanceCorrections: AttendanceCorrection;
  attendanceImports: AttendanceImportBatch;
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
  staffingPlans: StaffingPlan;
  recruitmentRequisitions: RecruitmentRequisition;
  interviews: CandidateInterview;
  employmentOffers: EmploymentOffer;
  employeeReferrals: EmployeeReferral;
  lifecycleEvents: EmploymentLifecycleEvent;
  exitInterviews: ExitInterview;
  finalSettlements: FinalSettlementIntent;
  shiftAssignments: ShiftAssignment;
  shiftRequests: ShiftRequest;
  leaveTypes: LeaveType;
  leavePolicies: LeavePolicy;
  holidayLists: HolidayList;
  leaveLedger: LeaveLedgerEntry;
  expenses: EmployeeExpense;
  trainingPrograms: TrainingProgram;
  trainingEvents: TrainingEvent;
  trainingOutcomes: TrainingOutcome;
  performanceCycles: PerformanceCycle;
  performanceGoals: PerformanceGoal;
  salaryComponents: SalaryComponent;
  salaryStructures: SalaryStructure;
  additionalPayments: AdditionalPayment;
  payrollRuns: PayrollRun;
  salarySlips: SalarySlip;
  taxBenefitRules: TaxBenefitRule;
  employeeLoans: EmployeeLoan;
  taxDeclarations: TaxDeclaration;
  benefitEnrollments: BenefitEnrollment;
  vehicles: Vehicle;
  vehicleLogs: VehicleLog;
  workflows: HrWorkflowDefinition;
  integrationSubscriptions: HrIntegrationSubscription;
  notificationRules: HrNotificationRule;
  customizations: HrCustomizationDefinition;
}
