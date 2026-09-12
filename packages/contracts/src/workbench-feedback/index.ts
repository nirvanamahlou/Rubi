export const WORKBENCH_FEEDBACK_CONTRACT_VERSION = 1 as const;

export const WORKBENCH_FEEDBACK_DEPARTMENTS = [
  'finance',
  'reservations',
  'sales',
  'visa',
  'hr',
  'management',
] as const;

export type WorkbenchFeedbackDepartment =
  (typeof WORKBENCH_FEEDBACK_DEPARTMENTS)[number];

export interface WorkbenchFeedbackCreateInputV1 {
  id: string;
  branchId: string;
  department: WorkbenchFeedbackDepartment;
  subject: string;
  body: string;
  anonymous: boolean;
  attachmentDocumentIds: readonly string[];
}

export interface WorkbenchFeedbackReceiptV1 {
  id: string;
  trackingNumber: string;
  branchId: string;
  department: WorkbenchFeedbackDepartment;
  subject: string;
  anonymous: boolean;
  attachmentCount: number;
  recipientCount: number;
  submittedAt: string;
}

export interface WorkbenchFeedbackCreateResponseV1 {
  data: WorkbenchFeedbackReceiptV1;
}

export interface WorkbenchFeedbackDetailV1 extends Omit<
  WorkbenchFeedbackReceiptV1,
  'recipientCount'
> {
  body: string;
  sender: { id: string; displayName: string } | null;
  isOwn: boolean;
}

export interface WorkbenchFeedbackDetailResponseV1 {
  data: WorkbenchFeedbackDetailV1;
}
