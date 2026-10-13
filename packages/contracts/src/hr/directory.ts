/** Minimal public form references. Never expose salary, contact or identity documents. */
export interface HrDirectoryEmployee {
  id: string;
  personnelCode: string;
  name: string;
  branchId: string;
  userId: string | null;
  unit: string;
  position: string;
}
export interface HrDirectoryResponse {
  employees: HrDirectoryEmployee[];
  hasMore: boolean;
}
export interface HrFormReferences {
  users: { id: string; label: string; branchIds: string[] }[];
  currencies: { id: string; code: string; name: string }[];
}
export const hrDirectoryLabel = (employee: HrDirectoryEmployee) =>
  `${employee.name} · ${employee.personnelCode}${employee.unit ? ` · ${employee.unit}` : ''}`;
