import {
  moneyDecimal,
  moneyUnits,
  readAgencyCommission,
  readPassengerDeductions,
  type SalesContractDetail,
} from '@nora/contracts';

/** Payments are successive states of one instalment, not additional revenue. */
export function ledgerEvidence(c: SalesContractDetail) {
  if (!c.balances || !c.payments || !c.priceComponents) return [];
  const out: string[] = [];
  try {
    const currencies = new Set(
      [...c.balances, ...c.payments, ...c.priceComponents].map(
        (p) => p.currencyCode,
      ),
    );
    const sum = (rows: readonly { amount: string }[]) =>
      rows.reduce((n, p) => n + moneyUnits(p.amount), 0n);
    for (const currency of currencies) {
      const balance = c.balances.find((b) => b.currencyCode === currency);
      const pay = c.payments.filter((p) => p.currencyCode === currency);
      const components = c.priceComponents.filter(
        (p) => p.currencyCode === currency,
      );
      const valid = pay.filter(
        (p) => p.status !== 'FINANCE_VOIDED' && p.status !== 'FINANCE_REJECTED',
      );
      const scheduled = sum(valid);
      const total = balance ? moneyUnits(balance.amount) : undefined;
      out.push(
        `تطبیق ${currency}: اجزای پایه ${moneyDecimal(sum(components.filter((p) => p.type === 'BASE')))}، تخفیف قرارداد ${moneyDecimal(sum(components.filter((p) => p.type === 'DISCOUNT')))}، برنامه معتبر و پرداخت‌های آن ${moneyDecimal(scheduled)}، از آن وصول قطعی ${moneyDecimal(sum(valid.filter((p) => p.status === 'FINANCE_CONFIRMED')))}، ردشده ${moneyDecimal(sum(pay.filter((p) => p.status === 'FINANCE_REJECTED')))}، باطل‌شده ${moneyDecimal(sum(pay.filter((p) => p.status === 'FINANCE_VOIDED')))}`,
      );
      if (total !== undefined && scheduled !== total)
        out.push(
          `اختلاف مبلغ قرارداد با مجموع برنامه معتبر: ${moneyDecimal(total - scheduled)} ${currency}`,
        );
      if (
        balance &&
        moneyUnits(balance.confirmedPaid) > moneyUnits(balance.amount)
      )
        out.push(
          `اضافه‌وصول: ${moneyDecimal(moneyUnits(balance.confirmedPaid) - moneyUnits(balance.amount))} ${currency}`,
        );
    }
    const commission = readAgencyCommission(c.servicesDetail);
    if (commission)
      out.push(
        `کمیسیون آژانس به‌ازای بزرگسال ${commission.adult} و کودک ${commission.child} ریال؛ از مانده کسر نمی‌شود.`,
      );
    if (c.passengersDetail.length) {
      const deductions = Object.values(
        readPassengerDeductions(c.servicesDetail, c.passengersDetail),
      );
      for (const kind of ['commission', 'discount'] as const) {
        const amounts = deductions.flatMap((d) => (d[kind] ? [d[kind]!] : []));
        for (const currency of new Set(amounts.map((a) => a.currencyCode)))
          out.push(
            `${kind === 'commission' ? 'کمیسیون مسافران' : 'تخفیف مسافران'}: ${moneyDecimal(sum(amounts.filter((a) => a.currencyCode === currency)))} ${currency}؛ کسورات ثبت‌شده، بدون کسر مجدد.`,
          );
      }
    }
  } catch {
    out.push('بخشی از جزئیات قیمت قابل تطبیق نیست.');
  }
  return out;
}
