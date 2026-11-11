import {
  contractGuideAnswer,
  normalizeContractQuestion,
} from './contract-guides';
import { contractInspectionText } from './contract-inspection-text';

export async function inspectContractQuestion(
  message: string,
  previousId?: string,
): Promise<{ text: string; contractId?: string } | undefined> {
  const normalized = normalizeContractQuestion(message);
  const reference = normalized.match(
    /قرارداد\s*(?:شماره\s*)?([A-Za-z0-9][A-Za-z0-9/-]*)/u,
  )?.[1];
  const customerSearch = normalized
    .match(/قرارداد\s+(?:مشتری|به نام)\s+([^؟?]{2,80})/u)?.[1]
    ?.trim();
  const followup =
    previousId &&
    /کجا|اصلاح|وضعیت|حالا|بررسی|مانع|چرا|این قرارداد|بعدش|بعد از این|ادامه|پیگیریش/.test(
      normalized,
    );
  if (!reference && !customerSearch && !followup) return;
  const { salesApi, SalesApiError } =
    await import('@/modules/sales/api/client');
  try {
    let id = previousId;
    if (reference || customerSearch) {
      const page = await salesApi.list({
        search: (reference ?? customerSearch)!,
        pageSize: 10,
      });
      const matches = page.data.filter(
        (contract) =>
          contract.contractNumber === reference || contract.id === reference,
      );
      if (matches.length !== 1) {
        return {
          text: page.data.length
            ? 'شماره کامل قرارداد موردنظر را بنویسید. قراردادهای قابل مشاهده در نتیجه جست‌وجو ' +
              page.data.map((item) => item.contractNumber).join('، ')
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
          : 'خواندن وضعیت قرارداد انجام نشد. پس از برقراری اتصال دوباره بررسی کنید.',
    };
  }
}
