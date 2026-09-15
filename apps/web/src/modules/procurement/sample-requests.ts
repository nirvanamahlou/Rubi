import type { ProcurementRequestV1 } from '@nora/contracts';

export type ProcurementListRow = Pick<
  ProcurementRequestV1,
  'id' | 'number' | 'status'
> & {
  draft: Pick<
    ProcurementRequestV1['draft'],
    'title' | 'estimatedAmount' | 'currencyCode'
  >;
  sample?: true;
};

// Read-only examples for an empty local workspace. Never sent to the API.
export const sampleRequests: ProcurementListRow[] = [
  {
    id: 'sample-office-equipment',
    number: 'PR-1405-101',
    status: 'SUBMITTED',
    draft: {
      title: 'تجهیزات پشتیبانی شعبه مرکزی',
      estimatedAmount: '240000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-network-renewal',
    number: 'PR-1405-102',
    status: 'IN_REVIEW',
    draft: {
      title: 'تمدید اشتراک زیرساخت شبکه',
      estimatedAmount: '185000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-field-supplies',
    number: 'PR-1405-103',
    status: 'APPROVED',
    draft: {
      title: 'ملزومات پذیرش واحد عملیات',
      estimatedAmount: '98000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-service-contract',
    number: 'PR-1405-104',
    status: 'SOURCING',
    draft: {
      title: 'خدمات نگهداری تجهیزات اداری',
      estimatedAmount: '360000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-signage',
    number: 'PR-1405-105',
    status: 'CHANGES_REQUESTED',
    draft: {
      title: 'تابلوهای راهنمای شعبه شرق',
      estimatedAmount: '72000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
];
