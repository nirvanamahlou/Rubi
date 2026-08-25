import { Injectable } from '@nestjs/common';

export const DOCUMENT_TEMPLATE_POLICY_PORT = Symbol(
  'DOCUMENT_TEMPLATE_POLICY_PORT',
);

export interface DocumentTemplatePolicyQuery {
  documentType: string;
  templateId: string;
  templateVersion: string;
}

export interface ResolvedDocumentTemplatePolicy extends DocumentTemplatePolicyQuery {
  policyId: string;
  policyVersion: string;
  requiresLetterhead: boolean;
}

export interface DocumentTemplatePolicyPort {
  resolve(
    query: DocumentTemplatePolicyQuery,
  ): Promise<ResolvedDocumentTemplatePolicy | null>;
}

/**
 * Production-safe default: no document policy is silently invented. A real
 * Documents integration can replace this provider; until then every unknown
 * template fails closed. Tests inject explicit policies through the port.
 */
@Injectable()
export class FailClosedDocumentTemplatePolicyAdapter implements DocumentTemplatePolicyPort {
  async resolve(): Promise<null> {
    return null;
  }
}
