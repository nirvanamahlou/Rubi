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
  subject: string;
  description: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  organizationUnitId: string;
  executionOwnerUserId: string;
  reference?: string | undefined;
  leave?: WorkbenchLeaveInputV1 | undefined;
}

export interface WorkbenchRequestOptionsV1 {
  substituteUsers?:
    Array<{ id: string; displayName: string; username: string }> | undefined;
  units: Array<{
    id: string;
    name: string;
    users: Array<{ id: string; displayName: string; username: string }>;
  }>;
}

export interface WorkbenchRequestItemV1 {
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
  leave?: WorkbenchLeaveInputV1 | undefined;
  source?: 'workbench' | 'hr' | undefined;
}
