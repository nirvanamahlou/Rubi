export interface WorkbenchRequestInputV1 {
  subject: string;
  description: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  organizationUnitId: string;
  executionOwnerUserId: string;
  reference?: string;
}

export interface WorkbenchRequestOptionsV1 {
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
}
