import {
  contractGuides,
  formatContractGuide,
  normalizeContractQuestion,
  resolveContractGuide,
} from './contract-guides';

export function readContractFormHelp(message: string): string | undefined {
  const question = normalizeContractQuestion(message);
  if (/قرارداد\s*(?:شماره\s*)?[a-z0-9]/i.test(question)) return;
  const saved = document.querySelector<HTMLElement>('[data-nora-saved]');
  if (
    saved?.dataset.noraSaved &&
    /ثبت|ارسال|رسید|مدرک|بعد|حالا/.test(question)
  ) {
    return (
      'قرارداد ' +
      saved.dataset.noraSaved +
      ' ثبت و ارسال شد.' +
      (saved.dataset.noraReceiptError
        ? ' بارگذاری رسید کامل نشد؛ از بخش مدارک همان پرداخت اقدام کنید. قرارداد تازه نسازید.'
        : '')
    );
  }
  if (
    !/مرحله بعد|دکمه.*(?:فعال|کار)|جلو نمی|ثبت نمی|ثبت نمیشه|ادامه نمی|خطای ثبت|خطای فرم|ارور ثبت|گیر کرد|گیر کردم|ارسال نشد|ثبت نشد|پاسخ ثبت/.test(
      question,
    )
  )
    return;
  const stage = document.querySelector<HTMLElement>('[data-nora-stage]');
  if (!stage) return;
  const error = stage.dataset.noraError;
  if (stage.dataset.noraBusy === 'true')
    return 'عملیات در حال انجام است؛ تا دریافت نتیجه دوباره ثبت نکنید.';
  if (
    error &&
    stage.dataset.noraSubmitPhase === 'confirming' &&
    stage.dataset.noraCreatedNumber
  )
    return (
      'قرارداد ' +
      stage.dataset.noraCreatedNumber +
      ' ساخته شد؛ تأیید ارسال دریافت نشد. وضعیت همین شماره را از فهرست بخوانید و قرارداد جدید نسازید.\n' +
      error
    );
  if (error && stage.dataset.noraSubmitPhase === 'creating')
    return (
      error +
      '\nاگر پاسخ سرور به دستتان نرسید، ابتدا فهرست قراردادها را بررسی کنید؛ تا روشن شدن نتیجه فرم دیگری نسازید.'
    );
  let blockers: string[] = [];
  try {
    const value: unknown = JSON.parse(stage.dataset.noraBlockers || '[]');
    if (Array.isArray(value))
      blockers = value.filter((v): v is string => typeof v === 'string');
  } catch {
    /* The visible form error remains available. */
  }
  if (blockers.length && stage.dataset.noraReady !== 'true')
    return [
      stage.dataset.noraStage,
      ...new Set([error, ...blockers].filter(Boolean)),
    ].join('\n');
  if (error) {
    const guide = resolveContractGuide('راهنمای ' + error, true);
    return [
      `در مرحله «${stage.dataset.noraStage}» فرم این پیام را اعلام کرده است «${error}».`,
      guide?.text ??
        formatContractGuide(
          contractGuides.find((item) => item.id === 'blocked')!,
        ),
      'پس از اصلاح، وضعیت فرم در سؤال بعد دوباره خوانده می‌شود.',
    ].join('\n\n');
  }
  if (stage.dataset.noraReady === 'true') {
    const next = stage.dataset.noraStage?.includes('مسیر') ? 'price' : 'review';
    return [
      `در مرحله «${stage.dataset.noraStage}» شرایط فعلی ادامه فرم برقرار است.`,
      formatContractGuide(contractGuides.find((item) => item.id === next)!),
      'اگر هنگام ثبت پیام تازه‌ای دریافت کردید، متن همان پیام را بگویید.',
    ].join('\n\n');
  }
  return [
    `در مرحله «${stage.dataset.noraStage}» هستید.`,
    formatContractGuide(contractGuides.find((item) => item.id === 'blocked')!),
    'پیام دقیق کنار فیلد یا دکمه غیرفعال را بنویسید تا همان مورد بررسی شود.',
  ].join('\n\n');
}
