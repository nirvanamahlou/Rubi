import type { MasterDataRecord, SalesServiceInput } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';

export interface SalesInsuranceSelection {
  id: string;
  name: string;
  code: string;
  recordVersion: number;
  insurerId: string;
  insurerName: string;
}

export function selectSalesInsurance(
  plan: MasterDataRecord,
): SalesInsuranceSelection {
  if (
    plan.resource !== 'insurance-plans' ||
    plan.status !== 'active' ||
    !plan.id ||
    !plan.name.trim()
  )
    throw new Error('طرح بیمه را از فهرست بیمه‌های فعال انتخاب کنید.');
  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    recordVersion: plan.version,
    insurerId: String(plan.attributes.insurerId ?? ''),
    insurerName: String(plan.attributes.insurerName ?? ''),
  };
}

export async function loadSalesInsurancePlans(list = masterDataApi.list) {
  const records: MasterDataRecord[] = [];
  for (let page = 1; ; page++) {
    const response = await list('insurance-plans', {
      search: '',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    records.push(...response.data);
    if (records.length >= response.meta.total) break;
    if (!response.data.length)
      throw new Error('فهرست بیمه‌ها کامل دریافت نشد؛ دوباره تلاش کنید.');
  }
  return records.filter(
    (plan, index) =>
      plan.resource === 'insurance-plans' &&
      plan.status === 'active' &&
      records.findIndex((other) => other.id === plan.id) === index,
  );
}

// Selection only: a saved plan reference is not an issued policy or provider approval.
export function salesInsuranceService(
  plan?: SalesInsuranceSelection,
): SalesServiceInput {
  if (!plan?.id || !plan.name.trim())
    throw new Error('طرح بیمه را از فهرست بیمه‌های فعال انتخاب کنید.');
  return {
    clientKey: 'insurance',
    kind: 'INSURANCE',
    referenceId: plan.id,
    titleSnapshot: `بیمه — ${plan.name}`,
    status: 'NEEDS_RESERVATION_CONFIRMATION',
    metadata: {
      insuranceSelectionVersion: 1,
      insurancePlanName: plan.name,
      insurancePlanCode: plan.code,
      insurancePlanRecordVersion: plan.recordVersion,
      insurerId: plan.insurerId,
      insurerName: plan.insurerName,
    },
  };
}
