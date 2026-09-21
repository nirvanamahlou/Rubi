export const B2B_DOSSIER_SECTIONS = [
  { id: 'organization', label: 'پرونده سازمان' },
  { id: 'access', label: 'کاربران و دسترسی' },
  { id: 'contracts', label: 'قرارداد و شرایط تجاری' },
  { id: 'credit', label: 'اعتبار و تضمین' },
  { id: 'finance', label: 'مالی و تسویه' },
  { id: 'audit', label: 'گزارش و تاریخچه' },
] as const;
export type B2bDossierSection = (typeof B2B_DOSSIER_SECTIONS)[number]['id'];
export interface B2bOrganizationUserInput {
  branchId: string;
  roleName: string;
  sections: B2bDossierSection[];
  isActive: boolean;
  reason: string;
  version?: number;
}
export interface B2bOrganizationUser extends B2bOrganizationUserInput {
  id: string;
  userId: string;
  organizationId: string;
  displayName: string;
  username: string;
  accountStatus: string;
  version: number;
  updatedAt: string;
}
export interface B2bPortalSection {
  title: string;
  notice?: string;
  rows: { label: string; values: { label: string; value: string }[] }[];
}
export interface B2bPortalIdentity {
  displayName: string;
  organizationName: string;
  roleName: string;
  sections: B2bDossierSection[];
}
