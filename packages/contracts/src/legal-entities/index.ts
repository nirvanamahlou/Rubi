export const LEGAL_ENTITIES_CONTRACT_VERSION = 2 as const;

export const LEGAL_ENTITY_CODES = [
  'NIYAYESH_SEIR_SAHAR',
  'JAHAN_BASTAN',
] as const;

export const LEGAL_ENTITY_CONTEXT_ALL = 'ALL' as const;

export type LegalEntityCode = (typeof LEGAL_ENTITY_CODES)[number];
export type LegalEntitySelection =
  LegalEntityCode | typeof LEGAL_ENTITY_CONTEXT_ALL;

export interface LegalEntityBrandingSnapshot {
  legalEntityId: string;
  code: LegalEntityCode;
  persianName: string;
  latinName: string | null;
  tradeName: string | null;
  logoFileId: string | null;
  letterheadFileId: string | null;
  footerFileId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  economicCode: string | null;
  paymentText: string | null;
  sealFileId: string | null;
  authorizedSignatureId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  legalFooterText: string | null;
  version: number;
}

export interface LegalEntitySummary {
  id: string;
  code: LegalEntityCode;
  persianName: string;
  latinName: string | null;
  logoFileId: string | null;
  isActive: boolean;
  version: number;
  brandingSnapshotVersion: number;
  updatedAt: string;
}

export interface LegalEntityDetail extends LegalEntitySummary {
  tradeName: string | null;
  letterheadFileId: string | null;
  footerFileId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  economicCode: string | null;
  paymentText: string | null;
  sealFileId: string | null;
  authorizedSignatureId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  legalFooterText: string | null;
}

export interface LegalEntityContext {
  selection: LegalEntitySelection;
  legalEntity: LegalEntitySummary | null;
  isAggregate: boolean;
  version: number;
}

export interface LegalEntitySwitchRequest {
  selection: LegalEntitySelection;
  expectedVersion: number;
}

export interface LegalEntityUpdateRequest {
  expectedVersion: number;
  persianName?: string;
  latinName?: string | null;
  tradeName?: string | null;
  logoFileId?: string | null;
  letterheadFileId?: string | null;
  footerFileId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  nationalId?: string | null;
  registrationNumber?: string | null;
  economicCode?: string | null;
  paymentText?: string | null;
  sealFileId?: string | null;
  authorizedSignatureId?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  legalFooterText?: string | null;
}

export interface LegalEntityDocumentIssueRequest {
  issuerLegalEntityId: string;
  templateId: string;
  templateVersion: string;
  documentType: string;
  referenceEntityType: string;
  referenceEntityId: string;
  fileHash?: string;
}

export interface LegalEntityDocumentIssueMetadata {
  id: string;
  issuerLegalEntityId: string;
  issuerCode: LegalEntityCode;
  issuerName: string;
  brandingSnapshotId: string;
  brandingSnapshotVersion: number;
  templateId: string;
  templateVersion: string;
  templatePolicyId: string;
  templatePolicyVersion: string;
  actorUserId: string;
  issuedAt: string;
  documentType: string;
  referenceEntityType: string;
  referenceEntityId: string;
  fileHash: string | null;
  status: 'issued' | 'failed';
  reissueReason: string | null;
}

export interface LegalEntityIssueTargetPlan {
  targets: readonly LegalEntitySummary[];
  requiresExplicitIssuer: boolean;
  combinedLetterheadAllowed: false;
}
