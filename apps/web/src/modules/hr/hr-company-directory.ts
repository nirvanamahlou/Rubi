import {
  hrBranchKey,
  hrBranchName,
  type HrBootstrapDto,
} from '@nora/contracts';

/** IAM companies are the roots; HR branch records are their subsidiaries. */
export function hrCompanyDirectory(
  data: Pick<HrBootstrapDto, 'branches' | 'records'>,
) {
  const groups = new Map<
    string,
    {
      id: string;
      branchId: string;
      name: string;
      organizationBranchId: string;
      aliases: string[];
      branchIds: string[];
      isHeadquarters: boolean;
    }
  >();
  for (const company of data.branches) {
    const key = hrBranchKey(company.name);
    const existing = groups.get(key);
    if (existing) {
      existing.aliases.push(company.id);
      existing.branchIds.push(company.id);
    } else {
      groups.set(key, {
        id: company.id,
        branchId: company.id,
        name: hrBranchName(company.name),
        organizationBranchId: '',
        aliases: [company.id],
        branchIds: [company.id],
        isHeadquarters: false,
      });
    }
  }
  const owner =
    data.branches.find((b) => hrBranchKey(b.name) === 'دفتر مرکزی') ??
    data.branches[0];
  if (owner)
    groups.set('all-companies', {
      id: 'hr-headquarters',
      branchId: owner.id,
      name: 'همه شرکت‌ها',
      organizationBranchId: '',
      aliases: ['hr-headquarters'],
      branchIds: data.branches.map((b) => b.id),
      isHeadquarters: true,
    });
  return [...groups.values()];
}
