/** Native, explicit scope grants. Display names and job titles confer no authority. */
export const CALL_CENTER_SCOPED_ACCESS =
  'customer_affairs.call_center.scope.v1' as const;
export const CALL_CENTER_ACCESS_OPERATIONS = [
  [
    'customer_affairs.call_center.contacts.read.own',
    'مشاهده مخاطبان و سوابق تحت مسئولیت خود',
  ],
  [
    'customer_affairs.call_center.contacts.read.team',
    'مشاهده مخاطبان و سوابق تیم مجاز',
  ],
  [
    'customer_affairs.call_center.reports.read.own',
    'مشاهده گزارش‌ها و شاخص‌های خود',
  ],
  [
    'customer_affairs.call_center.reports.read.team',
    'مشاهده گزارش‌ها و شاخص‌های تیم مجاز',
  ],
  ['customer_affairs.call_center.calls.create', 'ثبت تماس دستی'],
  ['customer_affairs.call_center.notes.create', 'ثبت یادداشت کال سنتر'],
  [
    'customer_affairs.call_center.workflow.manage',
    'مدیریت درخواست‌ها و پیگیری‌های خود',
  ],
  [
    'customer_affairs.call_center.workflow.manage.team',
    'مدیریت درخواست‌ها و پیگیری‌های تیم مجاز',
  ],
  ['customer_affairs.call_center.outbound.own', 'تماس خروجی از داخلی خود'],
  [
    'customer_affairs.call_center.owner.assign',
    'تخصیص مسئول به مخاطب بدون مسئول',
  ],
  ['customer_affairs.call_center.owner.change', 'تغییر مسئول ثابت مخاطب'],
  [
    'customer_affairs.call_center.owner.history',
    'مشاهده تاریخچهٔ تخصیص و تغییر مسئول',
  ],
] as const;

export function hasScopedCallCenterAccess(permissions: readonly string[]) {
  return (
    permissions.includes(CALL_CENTER_SCOPED_ACCESS) ||
    permissions.some((p) =>
      CALL_CENTER_ACCESS_OPERATIONS.some(
        ([code]) =>
          ![
            'customer_affairs.call_center.calls.create',
            'customer_affairs.call_center.notes.create',
            'customer_affairs.call_center.workflow.manage',
          ].includes(code) && code === p,
      ),
    )
  );
}

export const CALL_CENTER_SALES_EXPERT = [
  CALL_CENTER_SCOPED_ACCESS,
  'customer_affairs.call_center.read',
  'customer_affairs.call_center.contacts.read.own',
  'customer_affairs.call_center.reports.read.own',
  'customer_affairs.call_center.calls.create',
  'customer_affairs.call_center.notes.create',
  'customer_affairs.call_center.workflow.manage',
  'customer_affairs.call_center.outbound.own',
] as const;

export function mustScopeCallCenter(
  before: { permissionCodes: readonly string[]; screenIds: readonly string[] },
  after: { permissionCodes: readonly string[]; screenIds: readonly string[] },
) {
  if (
    hasScopedCallCenterAccess(before.permissionCodes) ||
    hasScopedCallCenterAccess(after.permissionCodes)
  )
    return true;
  const native = (codes: readonly string[]) =>
    codes
      .filter((code) => code.startsWith('customer_affairs.call_center.'))
      .slice()
      .sort()
      .join('\n');
  return (
    native(before.permissionCodes) !== native(after.permissionCodes) ||
    before.screenIds.includes('customer-affairs.call-center') !==
      after.screenIds.includes('customer-affairs.call-center')
  );
}
export const CALL_CENTER_SALES_MANAGER = [
  ...CALL_CENTER_SALES_EXPERT,
  'customer_affairs.call_center.contacts.read.team',
  'customer_affairs.call_center.reports.read.team',
  'customer_affairs.call_center.workflow.manage.team',
  'customer_affairs.call_center.owner.assign',
  'customer_affairs.call_center.owner.change',
  'customer_affairs.call_center.owner.history',
] as const;
