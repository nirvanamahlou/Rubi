export const PROCUREMENT_STAFF_PERMISSION_CODES = [
  'procurement.read.own',
  'procurement.request.create',
  'procurement.request.update',
  'procurement.request.submit',
  'procurement.request.cancel',
] as const;

export const PROCUREMENT_ROLE_SPECS = [
  {
    code: 'procurement_approver',
    name: 'تأییدکننده خرید',
    permissions: [
      'procurement.read.all',
      'procurement.approve',
      'procurement.audit.read',
    ],
  },
  {
    code: 'procurement_buyer',
    name: 'کارشناس تأمین و سفارش',
    permissions: [
      'procurement.read.all',
      'procurement.assign',
      'procurement.quote.manage',
      'procurement.quote.select',
      'procurement.order.manage',
      'procurement.order.issue',
      'procurement.order.amend',
      'procurement.order.cancel',
      'procurement.receipt.manage',
      'procurement.acceptance.manage',
      'procurement.discrepancy.manage',
      'procurement.return.manage',
      'procurement.invoice.manage',
      'procurement.invoice.submit_finance',
      'procurement.audit.read',
    ],
  },
] as const;
