/* Organize the existing package controls without replacing their inputs or listeners. */
(() => {
  const workspace = document.getElementById('packageWorkspace');
  const controls = workspace?.querySelector('.controls');
  if (!controls || controls.dataset.editorUiReady === 'true') return;

  const original = [...controls.querySelectorAll(':scope > section')];
  if (original.length !== 6) return;
  controls.dataset.editorUiReady = 'true';

  const fieldLabel = (id) => document.getElementById(id)?.closest('label');
  const settings = original[3];
  const unitLabel = fieldLabel('unit');
  const unitHelp = unitLabel?.nextElementSibling?.matches('small.muted')
    ? unitLabel.nextElementSibling : null;
  const perPageLabel = fieldLabel('perPage');
  const firstSettingsField = fieldLabel('fontSize');
  if (unitLabel && firstSettingsField) settings.insertBefore(unitLabel, firstSettingsField);
  if (unitHelp && firstSettingsField) settings.insertBefore(unitHelp, firstSettingsField);
  if (perPageLabel && firstSettingsField) settings.insertBefore(perPageLabel, firstSettingsField);

  const content = document.createElement('section');
  content.className = 'editor-content-fields';
  const serviceLabel = fieldLabel('services');
  const oldServiceHelp = serviceLabel?.nextElementSibling?.matches('small.muted')
    ? serviceLabel.nextElementSibling : null;
  if (serviceLabel) content.append(serviceLabel);
  oldServiceHelp?.remove();
  for (const id of ['notes', 'adjustments']) {
    const label = fieldLabel(id);
    if (label) content.append(label);
  }
  settings.before(content);

  const cardHelpers = original[2].querySelectorAll(':scope > p.muted');
  if (cardHelpers.length > 1) cardHelpers[1].remove();
  const importButton = document.getElementById('importCards');
  if (importButton) importButton.textContent = 'دریافت دوباره از فایل';

  const optionalBox = (title, className) => {
    const box = document.createElement('details');
    box.className = className;
    const summary = document.createElement('summary');
    summary.textContent = title;
    box.append(summary);
    return box;
  };
  const packageText = original[4];
  const sectionPicker = fieldLabel('textSection');
  const globalFontLabel = fieldLabel('globalFont');
  const fontUploadLabel = fieldLabel('fontUpload');
  const globalFontHelp = fontUploadLabel?.nextElementSibling?.matches('small.muted')
    ? fontUploadLabel.nextElementSibling : null;
  if (sectionPicker && globalFontLabel && fontUploadLabel) {
    const fontBox = optionalBox('فونت کل طرح و بارگذاری فونت', 'editor-secondary-fields');
    sectionPicker.before(fontBox);
    fontBox.append(globalFontLabel, fontUploadLabel);
    if (globalFontHelp) fontBox.append(globalFontHelp);
  }
  const sectionAlignLabel = fieldLabel('sectionAlign');
  const alignRow = sectionAlignLabel?.parentElement;
  const weightLabel = fieldLabel('sectionWeight');
  const sectionFontLabel = fieldLabel('sectionFont');
  const sizeRow = fieldLabel('sectionSize')?.parentElement;
  if (sectionAlignLabel && alignRow?.classList.contains('two')) {
    const scope = document.createElement('label');
    scope.className = 'layer-switch editor-align-scope';
    scope.innerHTML = '<input id="packageAlignAll" type="checkbox"> اعمال چینش به کل طرح';
    alignRow.before(sectionAlignLabel, scope);
    sectionAlignLabel.firstChild.textContent = 'چینش متن';
    const styleBox = optionalBox('فونت، اندازه، رنگ و ضخامت این بخش', 'editor-secondary-fields');
    scope.after(styleBox);
    if (sectionFontLabel) styleBox.append(sectionFontLabel);
    if (sizeRow) styleBox.append(sizeRow);
    if (weightLabel) styleBox.append(weightLabel);
    alignRow.remove();
    scope.querySelector('input').addEventListener('change', event => {
      document.getElementById('sectionAlign').value = event.target.checked
        ? document.getElementById('globalAlign').value
        : PackageEditor.getAlignment(document.getElementById('textSection').value);
    });
  }
  const extraTable = optionalBox('صفحه‌بندی و نمایش محدودهٔ لایه‌ها', 'editor-secondary-fields');
  settings.append(extraTable);
  if (perPageLabel) extraTable.append(perPageLabel);
  const layersLabel = fieldLabel('showLayers');
  const layersHelp = layersLabel?.nextElementSibling?.matches('small.muted')
    ? layersLabel.nextElementSibling : null;
  if (layersLabel) extraTable.append(layersLabel);
  if (layersHelp) extraTable.append(layersHelp);

  const cardMore = optionalBox('بازگردانی و دریافت دوبارهٔ قیمت‌ها', 'editor-secondary-fields');
  original[2].append(cardMore);
  const resetCards = document.getElementById('resetCards');
  if (resetCards) cardMore.append(resetCards);
  if (importButton) cardMore.append(importButton);

  const logoMore = optionalBox('اندازه و بازگردانی لوگوها', 'editor-secondary-fields');
  document.getElementById('assetStatus')?.before(logoMore);
  for (const key of ['agency', 'airline']) {
    const scale = fieldLabel(key + 'Scale');
    const reset = document.getElementById(key + 'Reset');
    if (scale) logoMore.append(scale);
    if (reset) logoMore.append(reset);
  }

  const sections = [original[0], original[1], original[2], content,
    original[3], original[4], original[5]];
  const groups = [
    ['فایل و قالب', 'انتخاب طرح و ورود فایل'],
    ['مشخصات سفر', 'عنوان، تاریخ و مدت'],
    ['کادرهای قیمت', 'عنوان، مبلغ و ارز'],
    ['متن و توضیحات', 'خدمات و تاریخ‌های نرخ'],
    ['تنظیمات نمایش', 'ارز جدول و ظاهر'],
    ['ویرایش دقیق متن', 'فونت و چینش هر بخش'],
    ['لوگوها', 'آژانس و ایرلاین']
  ];
  const details = sections.map((section, index) => {
    section.querySelector(':scope > h2')?.remove();
    const group = document.createElement('details');
    group.className = 'editor-group';
    group.dataset.editorGroup = String(index);
    group.open = index < 2;

    const summary = document.createElement('summary');
    const number = document.createElement('span');
    number.className = 'editor-group-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.className = 'editor-group-label';
    const title = document.createElement('strong');
    title.textContent = groups[index][0];
    const hint = document.createElement('small');
    hint.textContent = groups[index][1];
    label.append(title, hint);
    const arrow = document.createElement('span');
    arrow.className = 'editor-group-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    summary.append(number, label, arrow);
    section.before(group);
    group.append(summary, section);
    return group;
  });

  const nav = document.createElement('nav');
  nav.className = 'editor-nav';
  nav.setAttribute('aria-label', 'دسترسی سریع به فیلدهای ویرایش');
  const navItems = [
    ['فایل', 0], ['سفر', 1], ['قیمت‌ها', 2], ['متن', 3], ['نمایش', 4]
  ];
  const jumpTo = (index) => {
    const group = details[index];
    if (!group) return;
    group.open = true;
    const desktop = window.matchMedia('(min-width: 681px)').matches;
    if (desktop) {
      const distance = group.getBoundingClientRect().top
        - controls.getBoundingClientRect().top - nav.offsetHeight - 8;
      controls.scrollTo({ top: controls.scrollTop + distance, behavior: 'smooth' });
    } else {
      group.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    group.querySelector('summary')?.focus({ preventScroll: true });
  };
  for (const [title, index] of navItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = title;
    button.setAttribute('aria-label', `رفتن به بخش ${groups[index][0]}`);
    button.addEventListener('click', () => jumpTo(index));
    nav.append(button);
  }
  controls.prepend(nav);
})();

/* Banner fields are created at runtime; keep their existing nodes and bindings. */
(() => {
  const controls = document.querySelector('#bannerWorkspace .banner-controls');
  if (!controls || controls.dataset.editorUiReady === 'true') return;
  const sections = [
    document.getElementById('bannerDesign')?.closest('section'),
    controls.querySelector('[data-banner-field="offer"]')?.closest('section'),
    document.getElementById('bannerAddHotel')?.closest('section'),
    document.getElementById('bannerBackground')?.closest('section'),
    document.getElementById('bannerFontUpload')?.closest('section'),
    controls.querySelector('[data-banner-field="phone"]')?.closest('section')
  ];
  if (sections.some(section => !section) || new Set(sections).size !== 6) return;
  const itemExtras = [...controls.querySelectorAll(':scope > section')]
    .filter(section => ['collectionFields', 'installmentFields', 'visaCountriesSection', 'visaTextSection'].includes(section.id));
  controls.dataset.editorUiReady = 'true';

  const travel = sections[1];
  const optionalFields = (title, keys) => {
    const box = document.createElement('details');
    box.className = 'banner-optional-fields';
    const summary = document.createElement('summary');
    summary.textContent = title;
    box.append(summary);
    for (const key of keys) {
      const field = travel.querySelector(`[data-banner-field="${key}"]`);
      const host = ['commission', 'flight'].includes(key)
        ? field?.closest('.two') : field?.closest('label');
      if (host) box.append(host);
    }
    travel.append(box);
    const refresh = () => {
      const visible = [...box.querySelectorAll('[data-banner-field]')].some(field => {
        const host = field.closest('.two') || field.closest('label');
        return host && !host.hidden;
      });
      if (box.hidden === visible) box.hidden = !visible;
    };
    new MutationObserver(refresh).observe(box, {
      subtree: true, attributes: true, attributeFilter: ['hidden']
    });
    refresh();
  };
  optionalFields('نام‌ها و متن‌های تکمیلی',
    ['english', 'country', 'slogan', 'dateLabel', 'airline', 'tagline', 'cta', 'signoff']);
  optionalFields('نرخ پرواز و کمیسیون',
    ['commissionLabel', 'commission', 'flightLabel', 'flight']);

  const bannerText = sections[4];
  const bannerAlignLabel = document.getElementById('bannerSectionAlign')?.closest('label');
  if (bannerAlignLabel) {
    const scope = document.createElement('label');
    scope.className = 'layer-switch editor-align-scope';
    scope.innerHTML = '<input id="bannerAlignAll" type="checkbox"> اعمال چینش به کل بنر';
    bannerAlignLabel.after(scope);
    bannerAlignLabel.firstChild.textContent = 'چینش متن';
    scope.querySelector('input').addEventListener('change', event => {
      document.getElementById('bannerSectionAlign').value = event.target.checked
        ? document.getElementById('bannerGlobalAlign').value
        : BannerEditor.getAlignment(document.getElementById('bannerAlignSection').value);
    });
  }
  const bannerFontRows = [...new Set([...bannerText.querySelectorAll('[data-banner-font]')]
    .map(field => field.closest('.two')).filter(Boolean))];
  const bannerFontUpload = document.getElementById('bannerFontUpload')?.closest('label');
  const bannerColors = document.getElementById('bannerPrimary')?.closest('.two');
  const bannerStyleReset = document.getElementById('bannerStyleReset');
  const bannerMore = document.createElement('details');
  bannerMore.className = 'editor-secondary-fields';
  const bannerMoreSummary = document.createElement('summary');
  bannerMoreSummary.textContent = 'فونت، اندازه و رنگ بنر';
  bannerMore.append(bannerMoreSummary, ...bannerFontRows);
  if (bannerFontUpload) bannerMore.append(bannerFontUpload);
  if (bannerColors) bannerMore.append(bannerColors);
  if (bannerStyleReset) bannerMore.append(bannerStyleReset);
  document.getElementById('bannerAlignReset')?.after(bannerMore);
  bannerText.querySelector(':scope > small.muted')?.remove();

  const hotelAlign = document.querySelector('#hotelForm .hotel-align-controls');
  if (hotelAlign) {
    const hotelMore = document.createElement('details');
    hotelMore.className = 'editor-secondary-fields hotel-align-more';
    const summary = document.createElement('summary');
    summary.textContent = 'چینش جداگانهٔ نام، خدمات و قیمت';
    hotelAlign.before(hotelMore);
    hotelMore.append(summary, hotelAlign);
  }
  const imageMore = document.createElement('details');
  imageMore.className = 'editor-secondary-fields';
  const imageSummary = document.createElement('summary');
  imageSummary.textContent = 'بازگردانی عکس و تنظیم اندازهٔ لوگوها';
  imageMore.append(imageSummary);
  const backgroundReset = document.getElementById('bannerBackgroundReset');
  const backgroundHelp = backgroundReset?.nextElementSibling?.matches('small.muted')
    ? backgroundReset.nextElementSibling : null;
  if (backgroundReset) imageMore.append(backgroundReset);
  if (backgroundHelp) imageMore.append(backgroundHelp);
  for (const key of ['agency', 'airline']) {
    for (const selector of [`[data-banner-show="${key}"]`, `[data-banner-scale="${key}"]`]) {
      const label = controls.querySelector(selector)?.closest('label');
      if (label) imageMore.append(label);
    }
    const reset = controls.querySelector(`[data-banner-logo-reset="${key}"]`);
    if (reset) imageMore.append(reset);
  }
  sections[3].append(imageMore);

  const featureMore = document.createElement('details');
  featureMore.className = 'editor-secondary-fields';
  const featureSummary = document.createElement('summary');
  featureSummary.textContent = 'متن خدمات و مزایا';
  featureMore.append(featureSummary);
  for (let i = 1; i <= 5; i++) {
    const label = controls.querySelector(`[data-banner-field="feature${i}"]`)?.closest('label');
    if (label) featureMore.append(label);
  }
  sections[5].append(featureMore);
  const refreshFeatures = () => {
    const visible = [...featureMore.querySelectorAll('[data-banner-field]')]
      .some(field => !field.closest('label')?.hidden);
    if (featureMore.hidden === visible) featureMore.hidden = !visible;
  };
  new MutationObserver(refreshFeatures).observe(featureMore, {
    subtree: true, attributes: true, attributeFilter: ['hidden']
  });
  refreshFeatures();
  const visaFields = document.getElementById('visaCountryFields');
  if (visaFields) {
    const compactVisaAlignment = () => {
      const namePair = visaFields.querySelector('[data-visa-field="align"]')?.closest('.two');
      if (namePair && !namePair.parentElement.classList.contains('visa-align-details')) {
        const box = document.createElement('details');
        box.className = 'visa-align-details';
        const summary = document.createElement('summary');
        summary.textContent = 'چینش نام و توضیح کشور';
        namePair.before(box);
        box.append(summary, namePair);
      }
      for (const field of visaFields.querySelectorAll('[data-visa-property="align"]')) {
        const label = field.closest('label');
        if (!label || label.parentElement.classList.contains('visa-align-details')) continue;
        const box = document.createElement('details');
        box.className = 'visa-align-details';
        const summary = document.createElement('summary');
        summary.textContent = 'چینش این خدمت';
        label.before(box);
        box.append(summary, label);
      }
    };
    new MutationObserver(compactVisaAlignment).observe(visaFields, { childList: true });
  }

  const choices = document.getElementById('bannerTemplateChoices');
  if (choices) {
    const gallery = document.createElement('details');
    gallery.className = 'banner-gallery-details';
    const summary = document.createElement('summary');
    summary.textContent = 'دیدن همهٔ قالب‌ها به‌صورت تصویری';
    choices.before(gallery);
    gallery.append(summary, choices);
  }

  const labels = [
    ['دسته و قالب', 'انتخاب نوع و طرح بنر'],
    ['شهر و سفر', 'عنوان، تاریخ و نرخ‌ها'],
    ['موارد بنر', 'هتل‌ها، کشورها یا کارت‌ها'],
    ['عکس و لوگو', 'تصویر زمینه و نشان‌ها'],
    ['متن و ظاهر', 'فونت، رنگ و چینش'],
    ['تماس و خدمات', 'تلفن، آدرس و متن‌ها']
  ];
  const details = sections.map((section, index) => {
    section.classList.add('editor-base-section');
    const group = document.createElement('details');
    group.className = 'editor-group';
    group.dataset.editorGroup = String(index);
    group.open = index < 2;
    const summary = document.createElement('summary');
    const number = document.createElement('span');
    number.className = 'editor-group-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span');
    title.className = 'editor-group-label';
    const strong = document.createElement('strong');
    strong.textContent = labels[index][0];
    const hint = document.createElement('small');
    hint.textContent = labels[index][1];
    title.append(strong, hint);
    const arrow = document.createElement('span');
    arrow.className = 'editor-group-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    summary.append(number, title, arrow);
    section.before(group);
    group.append(summary, section);
    if (index === 2) {
      const members = [...itemExtras, section].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      group.append(...members);
    }
    return group;
  });

  const nav = document.createElement('nav');
  nav.className = 'editor-nav';
  nav.setAttribute('aria-label', 'دسترسی سریع به فیلدهای بنر');
  for (const [text, index] of [['قالب', 0], ['سفر', 1], ['موارد', 2], ['تماس', 5], ['ظاهر', 4]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', `رفتن به بخش ${labels[index][0]}`);
    button.addEventListener('click', () => {
      const group = details[index];
      group.open = true;
      if (window.matchMedia('(min-width: 681px)').matches) {
        const distance = group.getBoundingClientRect().top
          - controls.getBoundingClientRect().top - nav.offsetHeight - 8;
        controls.scrollTo({ top: controls.scrollTop + distance, behavior: 'smooth' });
      } else {
        group.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      group.querySelector('summary')?.focus({ preventScroll: true });
    });
    nav.append(button);
  }
  controls.prepend(nav);
})();
