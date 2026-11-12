import {
  contractGuideAnswer,
  normalizeContractQuestion,
} from './contract-guides';
import { contractInspectionText } from './contract-inspection-text';

import {
  portfolioKind,
  portfolioReport,
  recordReport,
} from './contract-reports';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
export async function inspectContractQuestion(
  message: string,
  previousId?: string,
): Promise<{ text: string; contractId?: string } | undefined> {
  const normalized = normalizeContractQuestion(message);
  const refs = [
    ...normalized.matchAll(
      /قرارداد\s*(?:شماره\s*)?([A-Za-z0-9][A-Za-z0-9/-]*)/gu,
    ),
  ];
  if (
    refs.length > 1 ||
    /قرارداد\s*(?:شماره\s*)?[A-Za-z0-9/-]+\s+و\s+[0-9]/u.test(normalized)
  )
    return {
      text: 'برای جلوگیری از اشتباه، هر بار شماره یک قرارداد را مشخص کنید.',
    };
  const portfolio = portfolioKind(message);
  const reference = normalized.match(
    /قرارداد\s*(?:شماره\s*)?([A-Za-z0-9][A-Za-z0-9/-]*)/u,
  )?.[1];
  const customerSearch = normalized
    .match(/قرارداد\s+(?:مشتری|به نام)\s+([^؟?]{2,80})/u)?.[1]
    ?.trim();
  const followup =
    previousId &&
    /کجا|اصلاح|وضعیت|حالا|بررسی|مانع|چرا|این قرارداد|بعدش|بعد از این|ادامه|پیگیریش|تاریخچه|تغییرات|رسید|مغایرت|مدارک|خدمات/.test(
      normalized,
    );
  if (!reference && !customerSearch && !followup && !portfolio) return;
  const { salesApi, SalesApiError } =
    await import('@/modules/sales/api/client');
  try {
    if (portfolio) {
      const base = getPublicApiBaseUrl();
      const session = base && (await refreshAuthenticatedSession(base));
      if (!session)
        return { text: 'برای گزارش قراردادها دوباره وارد حساب خود شوید.' };
      return { text: await portfolioReport(message, session.user.id) };
    }
    let id = previousId;
    if (reference || customerSearch) {
      let page = await salesApi.list({
        search: (reference ?? customerSearch)!,
        pageSize: 10,
      });
      const candidates = [...page.data];
      const exact = (item: (typeof candidates)[number]) =>
        reference &&
        (item.contractNumber.toLowerCase() === reference.toLowerCase() ||
          item.id.toLowerCase() === reference.toLowerCase());
      while (
        reference &&
        !candidates.some(exact) &&
        page.data.length &&
        page.meta.page * page.meta.pageSize < page.meta.total
      ) {
        const next = await salesApi.list({
          search: reference,
          page: page.meta.page + 1,
          pageSize: page.meta.pageSize,
        });
        if (next.meta.page <= page.meta.page) throw new Error('pagination');
        page = next;
        candidates.push(...page.data);
      }
      const matches = candidates.filter(exact);
      if (matches.length !== 1) {
        return {
          text: candidates.length
            ? 'شماره کامل قرارداد موردنظر را بنویسید. قراردادهای قابل مشاهده در نتیجه جست‌وجو ' +
              candidates
                .slice(0, 10)
                .map((item) => item.contractNumber)
                .join('، ') +
              (page.meta.total > 10
                ? '؛ برای محدود کردن نتیجه، شماره کامل را بنویسید.'
                : '')
            : 'قرارداد منطبق در فهرست قابل مشاهده حساب شما پیدا نشد.',
        };
      }
      id = matches[0]!.id;
    }
    if (!id) return;
    const { data } = await salesApi.detail(id);
    return {
      contractId: id,
      text: [
        contractInspectionText(data),
        await recordReport(message, data),
        /چطور|چجور|چگونه|کجا|مراحل|نحوه|راهنما/.test(message)
          ? contractGuideAnswer(message, true, true)
          : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  } catch (error) {
    return {
      text:
        error instanceof SalesApiError &&
        (error.status === 401 || error.status === 403)
          ? 'دسترسی حساب شما برای خواندن این قرارداد برقرار نیست.'
          : error instanceof SalesApiError && error.status === 404
            ? 'قرارداد یا منبع مرتبط در محدوده قابل مشاهده پیدا نشد.'
            : 'خواندن وضعیت قرارداد انجام نشد. پس از برقراری اتصال دوباره بررسی کنید.',
    };
  }
}
