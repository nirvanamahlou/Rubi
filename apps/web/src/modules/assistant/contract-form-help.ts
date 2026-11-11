export function readContractFormHelp(message: string): string | undefined {
  const stage = document.querySelector<HTMLElement>('[data-nora-stage]');
  if (
    !stage ||
    !/مرحله بعد|جلو نمی|ثبت نمی|گیر کرد|خطا|مشکل|چرا|حالا کجا/.test(message)
  )
    return;
  const error = stage.dataset.noraError;
  if (error)
    return [
      `در مرحله «${stage.dataset.noraStage}» فرم این پیام را اعلام کرده است «${error}».`,
      'همان مورد را در این مرحله اصلاح کنید و دوباره دکمه ادامه یا ثبت را بزنید. اطلاعات فرم در سؤال بعد دوباره بررسی می‌شود.',
    ].join('\n');
  return stage.dataset.noraReady === 'true'
    ? `در مرحله «${stage.dataset.noraStage}» شرایط فعلی ادامه فرم برقرار است. دکمه ادامه یا ثبت را بزنید. اگر سرور خطا داد، متن آن را در همین چت مشخص کنید.`
    : `در مرحله «${stage.dataset.noraStage}» هستید. پیام دقیق کنار فیلد یا دکمه غیرفعال را مشخص کنید تا محل تکمیل اطلاعات روشن شود.`;
}
