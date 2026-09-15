import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import * as Joi from 'joi';
import type { ProcurementDraftV1 } from '@nora/contracts';
import type { ApprovalPolicy } from './domain/procurement.rules';

const policySchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }).required(),
  version: Joi.number().integer().min(1).required(),
  source: Joi.string().valid('SETTINGS').required(),
  approvedAt: Joi.string().isoDate().required(),
  branchId: Joi.string().guid({ version: 'uuidv4' }).required(),
  unitId: Joi.string().min(1).max(160).required(),
  category: Joi.string().min(1).max(160).required(),
  currencyCode: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .required(),
  maximumAmount: Joi.string()
    .pattern(/^(0|[1-9]\d{0,19})(\.\d{1,4})?$/)
    .required(),
  allowUnknownEstimate: Joi.boolean().required(),
  emergencyAllowed: Joi.boolean().required(),
  minimumQuotations: Joi.number().integer().min(1).required(),
  singleSourceAllowed: Joi.boolean().required(),
  steps: Joi.array()
    .min(1)
    .items(
      Joi.object({
        userId: Joi.string().guid({ version: 'uuidv4' }).required(),
        maximumAmount: Joi.string()
          .pattern(/^(0|[1-9]\d{0,19})(\.\d{1,4})?$/)
          .required(),
        permission: Joi.string().valid('procurement.approve').required(),
      }).unknown(false),
    )
    .required(),
}).unknown(false);

/** Settings owns approval and publishes a versioned artifact; no artifact means no submission. */
@Injectable()
export class ProcurementPolicyPort {
  async resolve(draft: ProcurementDraftV1): Promise<ApprovalPolicy | null> {
    const path = process.env.SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE;
    if (!path) return null;
    const source = await readFile(path, 'utf8').catch(() => null);
    if (!source) return null;
    let candidate: unknown;
    try {
      candidate = JSON.parse(source) as unknown;
    } catch {
      return null;
    }
    if (!Array.isArray(candidate)) return null;
    const policies: ApprovalPolicy[] = [];
    for (const entry of candidate) {
      const result = policySchema.validate(entry, { convert: false });
      if (result.error) return null;
      policies.push(result.value as ApprovalPolicy);
    }
    const matching = policies.filter(
      (policy) =>
        policy.branchId === draft.branchId &&
        policy.unitId === draft.unitId &&
        policy.category === draft.category &&
        policy.currencyCode === draft.currencyCode,
    );
    if (matching.length !== 1) return null;
    return matching[0] ?? null;
  }
}
