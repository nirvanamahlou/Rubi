import { HR_RESOURCE_COLUMNS } from './resource-columns';

export type HrResourceKey = keyof typeof HR_RESOURCE_COLUMNS;
export type HrFieldType =
  'text' | 'date' | 'time' | 'decimal' | 'money' | 'employee' | 'document';
export interface HrResourceField {
  key: string;
  label: string;
  type: HrFieldType;
  required: boolean;
  maxLength: number;
}
export interface HrResourceDefinition {
  key: HrResourceKey;
  section: string;
  tab: string;
  columns: readonly string[];
  fields: HrResourceField[];
  employeeRequired: boolean;
  sensitive: boolean;
  readOnly: boolean;
  approval: boolean;
  selfService: boolean;
  parentResources: readonly string[];
  parentOptional: boolean;
}

const parentResources: Record<string, string[]> = {
  'organization.units': ['organization.units'],
  'expenses.travel': ['time.mission', 'expenses.mission'],
  'expenses.advances': ['time.mission', 'expenses.mission'],
  'expenses.claims': ['time.mission', 'expenses.mission'],
  'contracts.amendments': ['contracts.active'],
  'contracts.termination': ['contracts.active'],
  'lifecycle.exit': ['lifecycle.separation'],
  'lifecycle.settlement': ['lifecycle.separation'],
  'recruitment.interviews': ['recruitment.applicants'],
  'recruitment.feedback': ['recruitment.applicants'],
  'recruitment.offers': ['recruitment.applicants'],
  'development.goals': ['development.cycles'],
  'development.selfReview': ['development.cycles'],
  'development.feedback': ['development.cycles'],
  'development.performance': ['development.cycles'],
  'payroll.additional': ['payroll.runs'],
  'payroll.incentives': ['payroll.runs'],
  'payroll.corrections': ['payroll.runs'],
  'assets.logs': ['assets.vehicles', 'fleet.vehicles'],
  'fleet.logs': ['fleet.vehicles', 'assets.vehicles'],
};
const readOnly = new Set([
  'time.periods',
  'time.leaveGrants',
  'employee.assignment',
  'employee.audit',
  'employee.attendance',
  'employee.leave',
  'employee.overtime',
  'employee.financial',
  'reports.audit',
  'reports.access',
  'reports.dashboard',
  'contracts.alerts',
  'time.attendance',
  'time.import',
  'finance.results',
  'finance.payments',
  'finance.bank',
  'finance.settlements',
  'payroll.accounting',
  'payroll.payslips',
  'payroll.reports',
  'requests.payslips',
  'requests.mobile',
]);
const selfService = new Set([
  'time.leave',
  'requests.leave',
  'time.corrections',
  'requests.attendance',
  'time.shiftRequests',
  'requests.shift',
  'time.mission',
  'expenses.mission',
  'requests.travel',
  'time.overtime',
  'requests.profile',
  'development.selfReview',
  'expenses.claims',
]);
const approval = new Set([
  ...selfService,
  'lifecycle.onboarding',
  'lifecycle.promotion',
  'lifecycle.transfer',
  'lifecycle.separation',
  'contracts.active',
  'contracts.amendments',
  'contracts.termination',
  'recruitment.offers',
  'expenses.advances',
  'expenses.approvals',
  'benefits.loans',
  'finance.batch',
  'payroll.runs',
]);

export function getHrResource(
  section: string,
  tab: string,
): HrResourceDefinition | undefined {
  const key = `${section}.${tab}` as HrResourceKey;
  if (!Object.prototype.hasOwnProperty.call(HR_RESOURCE_COLUMNS, key))
    return undefined;
  const columns = HR_RESOURCE_COLUMNS[key];
  const fields = columns.map((label, index): HrResourceField => ({
    key: `field${index}`,
    label,
    type:
      label === 'کارمند'
        ? 'employee'
        : /تاریخ|^از تاریخ$|^تا تاریخ$/.test(label)
          ? 'date'
          : /^ساعت شروع$|^ساعت پایان$|^ساعت تردد$/.test(label)
            ? 'time'
            : /مبلغ|هزینه|مطالبات|کسورات|وام|پاداش/.test(label) &&
                !/نوع|وضعیت|شرح|دلیل|مرکز|مدرک/.test(label)
              ? 'money'
              : ['تعداد روز', 'ظرفیت'].includes(label)
                ? 'decimal'
                : 'text',
    required: index === 0 || label === 'کارمند',
    maxLength: /شرح|تعهدات|بازخورد|توضیح/.test(label) ? 4000 : 500,
  }));
  return {
    key,
    section,
    tab,
    columns,
    fields,
    employeeRequired:
      columns.some((label) => label === 'کارمند') || section === 'employee',
    sensitive:
      section === 'recruitment' ||
      key === 'lifecycle.exit' ||
      [
        'contracts',
        'benefits',
        'payroll',
        'finance',
        'development',
        'documents',
      ].includes(section) ||
      (section === 'employee' &&
        ['contact', 'contract', 'docs', 'financial', 'performance'].includes(
          tab,
        )),
    readOnly: readOnly.has(key),
    approval: approval.has(key),
    selfService: selfService.has(key),
    parentResources: parentResources[key] ?? [],
    parentOptional: [
      'organization.units',
      'expenses.travel',
      'expenses.advances',
      'expenses.claims',
    ].includes(key),
  };
}
export const HR_RESOURCE_KEYS = Object.keys(
  HR_RESOURCE_COLUMNS,
) as HrResourceKey[];
