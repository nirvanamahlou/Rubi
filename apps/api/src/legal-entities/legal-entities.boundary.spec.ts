import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const service = readFileSync(
  resolve(process.cwd(), 'src/legal-entities/legal-entities.service.ts'),
  'utf8',
);

describe('legal entity module boundary', () => {
  it('does not query or scope operational CRM or Branch aggregates', () => {
    expect(service).not.toMatch(
      /client\.(customer|contract|reservation|finance|branch)\b/,
    );
    expect(service).not.toMatch(/ownerBranchId|activeBranchId|x-branch-id/);
  });

  it('revalidates a real active issuer and records reproducible output metadata', () => {
    expect(service).toContain('private async validateIssuer');
    expect(service).toContain('where: { id, isActive: true }');
    expect(service).toContain('brandingSnapshot: json(branding.snapshot)');
    expect(service).toContain('brandingSnapshotId: branding.id');
    expect(service).toContain('brandingSnapshotVersion: branding.version');
    expect(service).toContain('templatePolicyId: policy.policyId');
    expect(service).toContain("action: 'legal-entity.document.issue'");
    expect(service).toContain("action: 'legal-entity.document.reissue'");
    expect(service).toContain('assertRequiredLetterhead(');
    expect(service).toContain('this.templatePolicies.resolve(query)');
    expect(service).not.toContain('input.requiresLetterhead');
  });

  it('enforces optimistic claims and redacts sensitive branding by default', () => {
    expect(service).toContain('where: { id, version: expectedVersion }');
    expect(service).toContain("code: 'CONCURRENT_MODIFICATION'");
    expect(service).toContain(
      'sealFileId: includeSensitive ? row.sealFileId : null',
    );
    expect(service).toContain(
      'authorizedSignatureId: includeSensitive ? row.authorizedSignatureId : null',
    );
  });
});
