import type { HrRecordDto } from '@nora/contracts';

/** Resolve only the selected scope; a shared policy must not become a branch edit. */
export function savedPenaltySettings(
  records: readonly HrRecordDto[],
  branchId: string,
  company?: {
    isHeadquarters: boolean;
    organizationBranchId: string;
    aliases: string[];
  },
): HrRecordDto | undefined {
  return records
    .filter((record) => {
      if (
        record.section !== 'time' ||
        record.tab !== 'penaltySettings' ||
        record.deletedAt ||
        record.branchId !== branchId
      )
        return false;
      if (company?.isHeadquarters) return record.data.allBranches === true;
      if (record.data.allBranches) return false;
      const organization = record.data.organizationBranchId;
      return organization
        ? Boolean(company?.aliases.includes(organization))
        : !company?.organizationBranchId;
    })
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    )[0];
}
