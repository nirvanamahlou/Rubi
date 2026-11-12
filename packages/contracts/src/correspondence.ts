export type InternalLetterStatus =
  'SENT' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
export interface CorrespondenceUser {
  id: string;
  displayName: string;
  username: string;
  unit?: string;
  jobTitle?: string;
}
export interface InternalLetterContent {
  company: string;
  recipient: string;
  recipientTitle?: string;
  sender?: string;
  subject: string;
  date: string;
  number: string;
  attachment?: string;
  signer: string;
  text: string;
  template: string;
}
export interface InternalLetterAttachment {
  id: string;
  name: string;
  size: number;
}
export interface InternalLetterRecord {
  attachments?: InternalLetterAttachment[];
  id: string;
  version: number;
  dateISO: string;
  createdAt: string;
  updatedAt: string;
  author: CorrespondenceUser;
  letter: InternalLetterContent;
  delivery: {
    id: string;
    description?: string | null;
    sender: CorrespondenceUser;
    recipient: CorrespondenceUser;
    status: InternalLetterStatus;
    createdAt: string;
    readAt: string | null;
  };
}
export interface InternalLetterList {
  items: InternalLetterRecord[];
  total: number;
  page: number;
  pageSize: number;
  kpis: {
    total: number;
    unread: number;
    approved: number;
    needsCorrection: number;
  };
}
