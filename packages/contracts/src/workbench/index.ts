export type WorkbenchNoteItemV1 = { text: string; done: boolean };

export interface WorkbenchNoteV1 {
  id: string;
  title: string;
  body: string;
  folder: string;
  tags: string;
  items: WorkbenchNoteItemV1[];
  pinned: boolean;
  reminderAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbenchNotesResponseV1 {
  data: WorkbenchNoteV1[];
  folders: string[];
}

export interface WorkbenchNoteInputV1 {
  title: string;
  body: string;
  folder: string;
  tags: string;
  items: WorkbenchNoteItemV1[];
  pinned: boolean;
  reminderAt?: string | null;
  expectedVersion?: number;
}

export type WorkbenchCalendarStatusV1 =
  'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type WorkbenchCalendarPriorityV1 = 'NORMAL' | 'HIGH' | 'URGENT';

export interface WorkbenchCalendarEventV1 {
  id: string;
  branchId: string;
  title: string;
  description: string;
  dueAt: string;
  status: WorkbenchCalendarStatusV1;
  priority: WorkbenchCalendarPriorityV1;
  linkUrl: string | null;
  imageDocumentId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbenchCalendarEventInputV1 {
  id?: string;
  branchId: string;
  title: string;
  description: string;
  dueAt: string;
  status?: WorkbenchCalendarStatusV1;
  priority?: WorkbenchCalendarPriorityV1;
  linkUrl?: string | null;
  imageDocumentId?: string | null;
  expectedVersion?: number;
}

export interface WorkbenchCalendarResponseV1 {
  data: WorkbenchCalendarEventV1[];
  sources: {
    customerAffairs: WorkbenchCustomerAffairsCalendarItemV1[];
  };
}

export interface WorkbenchCustomerAffairsCalendarItemV1 {
  id: string;
  ticketId: string;
  trackingNumber: string;
  ticketSubject: string;
  title: string;
  destinationModule: string;
  destinationUnit: string | null;
  status: string;
  dueAt: string;
}

export interface WorkbenchActivityV1 {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
}

export interface WorkbenchActivityResponseV1 {
  data: WorkbenchActivityV1[];
}

export type WorkbenchPerformanceSectionV1<T> =
  | { status: 'ready'; data: T }
  | { status: 'forbidden' | 'error'; message: string };

export interface WorkbenchHrPerformanceV1 {
  approvedLeaveCount?: number;
  todayAttendance?: {
    date: string;
    firstIn: string | null;
    lastOut: string | null;
  };
  employee: {
    name: string;
    personnelCode: string;
    unit: string;
    position: string;
  } | null;
  leaves: WorkbenchHrPerformanceRecordV1[];
  shifts: WorkbenchHrPerformanceRecordV1[];
  leaveBalances: {
    type: string;
    granted: string;
    used: string;
    balance: string;
  }[];
  leaveYear: number | null;
  payslipVisible: boolean;
  latestPayslip: WorkbenchHrPerformanceRecordV1 | null;
}

export interface WorkbenchHrPerformanceRecordV1 {
  id: string;
  status: string;
  fields: { label: string; value: string }[];
  updatedAt: string;
}

export interface WorkbenchSalesPerformanceV1 {
  contracts: number;
  confirmedContracts: number;
  customers: number;
  amounts: { currencyCode: string; amount: string }[];
  partial: boolean;
}

export interface WorkbenchJobActivityV1 {
  modules: { key: string; label: string; count: number }[];
  recent: (WorkbenchActivityV1 & { moduleLabel: string })[];
  sourceLimit: number;
}

export interface WorkbenchPerformanceResponseV1 {
  generatedAt: string;
  period: { from: string; to: string; days: number };
  hr: WorkbenchPerformanceSectionV1<WorkbenchHrPerformanceV1>;
  sales: WorkbenchPerformanceSectionV1<WorkbenchSalesPerformanceV1>;
  activity: WorkbenchPerformanceSectionV1<WorkbenchJobActivityV1>;
}
