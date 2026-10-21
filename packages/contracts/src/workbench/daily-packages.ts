import type { DocumentScanStatusCode } from '../documents';

export interface WorkbenchDailyPackageV1 {
  id: string;
  title: string;
  branchId: string;
  authorName: string;
  createdAt: string;
  scanStatus: DocumentScanStatusCode;
}

export interface WorkbenchDailyPackagesResponseV1 {
  data: WorkbenchDailyPackageV1[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface WorkbenchDailyPackageOptionsV1 {
  data: { id: string; name: string }[];
}
