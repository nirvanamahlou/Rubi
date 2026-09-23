'use strict';

window.PackageGeneratorModeLoader = (() => {
  const bannerSources = [
    'banner-templates.js',
    'banner-backgrounds.js',
    'banner-reference-images.js',
    'banner-reference-crops.js',
    'banner-reference-layouts.js',
    'banner-reference-backgrounds.js',
    'banner-reference.js',
    'visa-assets.js',
    'visa-clean.js',
    'visa.js',
    'tourism-collection-assets.js',
    'tourism-collection-clean.js',
    'tourism-collection-layouts.js',
    'tourism-collection.js',
    'installment-assets.js',
    'installment-layouts.js',
    'installment.js',
    'banner.js',
  ];
  const stickerSources = ['sticker-assets.js', 'sticker.js'];
  const header = document.querySelector('.app-header');
  const tabs = document.createElement('nav');
  const status = document.createElement('span');
  let requestedMode = 'package';
  let bannerLoad;
  let stickerLoad;

  tabs.className = 'mode-tabs';
  tabs.setAttribute('aria-label', 'نوع خروجی');
  tabs.innerHTML =
    '<button id="packageMode" type="button" aria-pressed="true">پکیج جدولی / ترکیبی</button>' +
    '<button id="bannerMode" type="button" aria-pressed="false">بنر تصویری</button>' +
    '<button id="stickerMode" type="button" aria-pressed="false">تولید استیکر</button>';
  status.className = 'mode-load-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  header.append(tabs, status);

  const button = (mode) => document.getElementById(`${mode}Mode`);
  const announce = (message = '', error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
    status.hidden = !message;
  };
  const pressed = (mode) => {
    for (const name of ['package', 'banner', 'sticker'])
      button(name).setAttribute('aria-pressed', String(name === mode));
  };
  const loadScript = (source) =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = false;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error(`بارگذاری ${source} انجام نشد.`)),
        { once: true },
      );
      document.head.append(script);
    });
  const loadSequence = async (sources) => {
    for (const source of sources) await loadScript(source);
  };
  const finish = (mode) => {
    if (requestedMode !== mode) return;
    announce();
    if (mode === 'banner') window.BannerEditor.setMode('banner');
    else {
      document.getElementById('packageWorkspace').hidden = true;
      document.getElementById('bannerWorkspace')?.setAttribute('hidden', '');
      window.StickerEditor.setActive(true);
      pressed('sticker');
    }
  };
  const failed = (mode, error) => {
    if (requestedMode === mode) {
      pressed('package');
      document.getElementById('packageWorkspace').hidden = false;
      announce(error.message || 'بارگذاری این بخش انجام نشد.', true);
    }
  };

  const showPackage = () => {
    requestedMode = 'package';
    announce();
    if (window.BannerEditor) window.BannerEditor.setMode('package');
    else {
      document.getElementById('packageWorkspace').hidden = false;
      document.getElementById('stickerWorkspace')?.setAttribute('hidden', '');
      pressed('package');
    }
  };
  const showBanner = async () => {
    requestedMode = 'banner';
    pressed('banner');
    if (window.BannerEditor) return finish('banner');
    announce('در حال بارگذاری ابزار بنر…');
    bannerLoad ||= loadSequence(bannerSources).then(() =>
      loadScript('editor-ui.js?v=plus-minus&mode=banner'),
    );
    try {
      await bannerLoad;
      finish('banner');
    } catch (error) {
      failed('banner', error);
    }
  };
  const showSticker = async () => {
    requestedMode = 'sticker';
    pressed('sticker');
    if (window.StickerEditor) return finish('sticker');
    announce('در حال بارگذاری ابزار استیکر…');
    stickerLoad ||= loadSequence(stickerSources);
    try {
      await stickerLoad;
      finish('sticker');
    } catch (error) {
      failed('sticker', error);
    }
  };

  button('package').addEventListener('click', showPackage);
  button('banner').addEventListener('click', () => void showBanner());
  button('sticker').addEventListener('click', () => void showSticker());

  return { showPackage, showBanner, showSticker };
})();
