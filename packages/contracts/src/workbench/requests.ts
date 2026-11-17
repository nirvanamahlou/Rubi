export interface WorkbenchMissionV1 {
  destination: string;
  purpose: string;
  from: string;
  to: string;
  startTime: string;
  endTime: string;
  finance?: {
    amount: string;
    referToPetty: boolean;
    title: string;
    costCenter: string;
    fee: string;
    description: string;
    attachmentIds: string[];
  };
}
export interface WorkbenchLeaveInputV1 {
  from: string;
  to: string;
  mode: 'روزانه' | 'ساعتی';
  startTime?: string | undefined;
  endTime?: string | undefined;
  reason: string;
  substitute?: string | undefined;
  substituteUserId?: string | undefined;
  leaveType?: 'استحقاقی' | 'استعلاجی' | undefined;
  attachmentIds?: string[] | undefined;
}

export interface WorkbenchRequestInputV1 {
  mission?: WorkbenchMissionV1 | undefined;
  subject: string;
  description: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  organizationUnitId: string;
  executionOwnerUserId: string;
  reference?: string | undefined;
  leave?: WorkbenchLeaveInputV1 | undefined;
}

export interface WorkbenchRequestOptionsV1 {
  missionRoute?: { unitId: string; recipientId: string };
  leaveRoute?: { unitId: string; recipientId: string };
  substituteUsers?:
    Array<{ id: string; displayName: string; username: string }> | undefined;
  units: Array<{
    id: string;
    name: string;
    users: Array<{ id: string; displayName: string; username: string }>;
  }>;
}

export interface WorkbenchRequestItemV1 {
  branchId?: string;
  mission?: WorkbenchMissionV1 | undefined;
  progress?: {
    managerApproved: boolean;
    hrApproved: boolean;
    completed: boolean;
  };
  id: string;
  trackingNumber: string;
  subject: string;
  description: string;
  destinationUnit: string | null;
  status: string;
  priority: string;
  nextActionAt: string;
  updatedAt: string;
  direction: 'incoming' | 'outgoing' | 'self';
  senderName: string;
  recipientName: string | null;
  version?: number | undefined;
  substituteStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
  substituteReview?: boolean | undefined;
  recipientReview?: boolean | undefined;
  leave?: WorkbenchLeaveInputV1 | undefined;
  source?: 'workbench' | 'hr' | undefined;
}
