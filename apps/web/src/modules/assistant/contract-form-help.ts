import {
  contractGuides,
  formatContractGuide,
  normalizeContractQuestion,
  resolveContractGuide,
} from './contract-guides';

export function readContractFormHelp(message: string): string | undefined {
  const question = normalizeContractQuestion(message);
  if (
    !/مرحله بعد|دکمه.*(?:فعال|کار)|جلو نمی|ثبت نمی|ثبت نمیشه|ادامه نمی|خطای ثبت|خطای فرم|ارور ثبت|گیر کرد|گیر کردم/.test(
      question,
    )
  )
    return;
  const stage = document.querySelector<HTMLElement>('[data-nora-stage]');
  if (!stage) return;
  const error = stage.dataset.noraError;
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
