'use strict';

window.PackageGallery = (() => {
  const models = new Map();
  const get = id => document.getElementById(id);
  const workspace = get('packageWorkspace');
  const controls = workspace.querySelector('.controls');
  let selected = '', loading = false, exporting = false, editing = false;
  const template = () => PackageGalleryTemplates[get('template').value];
  const model = () => {
    const id = get('template').value;
    if (!models.has(id)) models.set(id, { fields: {}, selected: template().fields[0].id });
    return models.get(id);
  };
  const definition = () => template().fields.find(f => f.id === selected);
  const value = f => ({ ...f, ...model().fields[f.id] });
  const position = box => `left:${box[0]}px;top:${box[1]}px;width:${box[2]}px;height:${box[3]}px;`;
  const panel = document.createElement('section');
  panel.id = 'packageGalleryControls';
  panel.hidden = true;
  panel.innerHTML = '<h2>ویرایش قالب انتخاب‌شده</h2><p class="muted">روی نوشته یا عکس در پیش‌نمایش بزن یا بخش را از این فهرست انتخاب کن. اطلاعات و قیمت‌های تصویر، نمونهٔ قالب هستند؛ پیش از انتشار آن‌ها را بررسی کن.</p>' +
    '<label>بخش قالب<select id="galleryField"></select></label><div id="galleryTextOptions"><label>متن بخش<textarea id="galleryText" rows="4" maxlength="1200"></textarea></label>' +
    '<div class="two"><label>اندازه متن<input id="gallerySize" type="number" min="8" max="150" step="1"></label><label>رنگ متن<input id="galleryColor" type="color"></label></div>' +
    '<label>چینش<select id="galleryAlign"><option value="center">وسط‌چین</option><option value="right">راست‌چین</option><option value="left">چپ‌چین</option></select></label>' +
    '<label>فونت<select id="galleryFont"><option value="Vazirmatn Variable">فونت Rubi</option><option value="Tahoma">Tahoma</option><option value="Arial">Arial</option></select></label></div>' +
    '<div id="galleryImageOptions" hidden><label>انتخاب عکس / لوگو<input id="galleryImage" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="muted">عکس با حفظ نسبت تصویر در کادر همین بخش قرار می‌گیرد.</p></div>' +
    '<button id="galleryResetField" type="button">بازگرداندن بخش به نمونه</button><p id="galleryStatus" role="status" aria-live="polite"></p>';
  controls.append(panel);
  function status(text, error = false) {
    get('galleryStatus').textContent = text;
    get('galleryStatus').classList.toggle('error', error);
  }
  function syncPanel() {
    const f = definition(), current = value(f), image = f.kind === 'image';
    get('galleryField').value = selected;
    get('galleryTextOptions').hidden = image;
    get('galleryImageOptions').hidden = !image;
    if (!image) {
      get('galleryText').value = current.text;
      get('gallerySize').value = current.size;
      get('galleryColor').value = current.color;
      get('galleryAlign').value = current.align;
      get('galleryFont').value = current.font || 'Vazirmatn Variable';
    }
    get('galleryResetField').disabled = !model().fields[f.id] || loading || exporting;
  }
  function choose(id) {
    if (loading || exporting || !template().fields.some(f => f.id === id)) return;
    selected = id;
    model().selected = id;
    syncPanel();
  }
  function activate() {
    if (!template()) return;
    workspace.classList.add('package-gallery-mode');
    panel.hidden = false;
    const p = template();
    selected = model().selected;
    get('galleryField').replaceChildren(...p.fields.map(f => new Option(f.label, f.id)));
    syncPanel();
    render();
  }
  function leave() {
    workspace.classList.remove('package-gallery-mode');
    panel.hidden = true;
  }
  function fit(page) {
    let fits = true;
    for (const node of page.querySelectorAll('.gallery-text')) {
      let size = Number(node.dataset.size);
      while ((node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) && size > 9) {
        size -= 1;
        node.style.fontSize = size + 'px';
      }
      if (node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2) fits = false;
    }
    return fits;
  }
  function pageElement(reference = false) {
    const p = template(), page = document.createElement('article');
    page.className = 'package-page gallery-page';
    page.style.cssText = `width:${p.width}px;height:${p.height}px`;
    const background = document.createElement('img');
    background.src = p.image;
    background.className = 'gallery-background';
    background.alt = p.label;
    page.append(background);
    if (reference) return page;
    for (const f of p.fields) {
      const current = value(f), changed = model().fields[f.id];
      if (changed) {
        const node = document.createElement(f.kind === 'image' ? 'img' : 'div');
        node.className = f.kind === 'image' ? 'gallery-photo' : 'gallery-text';
        node.dataset.galleryValue = f.id;
        node.style.cssText = position(f.box) + `border-radius:${f.radius || 0}px;`;
        if (f.kind === 'image') { node.src = current.src; node.alt = f.label; }
        else {
          node.textContent = current.text;
          node.dataset.size = String(current.size);
          node.style.fontSize = current.size + 'px';
          node.style.fontFamily = current.font || 'Vazirmatn Variable';
          node.style.color = current.color;
          node.style.background = f.background;
          node.style.textAlign = current.align;
          node.style.direction = f.ltr ? 'ltr' : 'rtl';
        }
        page.append(node);
      }
      const hit = document.createElement('button');
      hit.type = 'button'; hit.className = 'gallery-hit';
      hit.dataset.galleryHit = f.id;
      hit.setAttribute('aria-label', 'ویرایش ' + f.label);
      hit.title = 'ویرایش ' + f.label;
      hit.style.cssText = position(f.box) + `border-radius:${f.radius || 0}px`;
      page.append(hit);
    }
    return page;
  }
  function render() {
    if (!template() || editing) return;
    const p = template(), host = get('pages'), scale = Math.min(1, Math.max(260, host.clientWidth - 4) / p.width);
    const page = pageElement(state.reference), wrap = document.createElement('div'), zoom = document.createElement('div');
    wrap.className = 'page-wrap'; wrap.style.cssText = `width:${p.width * scale}px;height:${p.height * scale}px`;
    zoom.className = 'page-scale'; zoom.style.transform = `scale(${scale})`;
    zoom.append(page); wrap.append(zoom); host.replaceChildren(wrap);
    state.layoutError = !fit(page);
    get('summary').textContent = p.label + ' • روی متن‌ها و عکس‌ها بزن و ویرایش کن.';
    get('warnings').textContent = state.layoutError ? 'متن در کادر جا نمی‌شود؛ متن را کوتاه‌تر کن.' : '';
    get('png').disabled = get('pdf').disabled = loading || exporting || state.layoutError;
    get('downloadNotice').hidden = true;
  }
  function editInline(id) {
    choose(id);
    const f = definition();
    if (f.kind === 'image') { get('galleryImage').click(); return; }
    const current = value(f), page = get('pages').querySelector('.gallery-page');
    const node = document.createElement('div');
    node.className = 'gallery-text gallery-inline';
    node.dataset.galleryInline = id; node.dataset.size = current.size;
    node.contentEditable = 'true'; node.setAttribute('role', 'textbox');
    node.setAttribute('aria-label', f.label); node.setAttribute('aria-multiline', 'true');
    node.textContent = current.text;
    node.style.cssText = position(f.box) + `font-size:${current.size}px;color:${current.color};background:${f.background};text-align:${current.align};direction:${f.ltr ? 'ltr' : 'rtl'};border-radius:${f.radius || 0}px;`;
    page.append(node); fit(page); editing = true; node.focus({ preventScroll: true });
    const range = document.createRange(); range.selectNodeContents(node);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  function commit(node) {
    const id = node.dataset.galleryInline, f = template().fields.find(f => f.id === id);
    const text = node.innerText.replace(/\r/g, '').slice(0, 1200);
    if (text !== value(f).text) model().fields[id] = { ...model().fields[id], text };
    editing = false; syncPanel(); render();
  }
  get('pages').addEventListener('click', event => {
    const hit = event.target.closest('[data-gallery-hit]');
    if (!hit || !template() || loading || exporting) return;
    event.preventDefault(); editInline(hit.dataset.galleryHit);
  });
  get('pages').addEventListener('focusout', event => {
    if (event.target.dataset.galleryInline) { event.stopImmediatePropagation(); commit(event.target); }
  }, true);
  get('pages').addEventListener('keydown', event => {
    if (event.target.dataset.galleryInline && event.key === 'Escape') { editing = false; render(); event.preventDefault(); }
  });
  get('galleryField').addEventListener('change', event => choose(event.target.value));
  for (const [id, property] of [['galleryText', 'text'], ['gallerySize', 'size'], ['galleryColor', 'color'], ['galleryAlign', 'align'], ['galleryFont', 'font']]) {
    get(id).addEventListener('input', event => {
      if (loading || exporting) return;
      const next = property === 'size' ? Math.min(150, Math.max(8, Number(event.target.value) || 8)) : event.target.value;
      model().fields[selected] = { ...model().fields[selected], [property]: next };
      state.reference = false; get('reference').textContent = 'نمایش مرجع';
      render(); get('galleryResetField').disabled = false;
    });
  }
  get('galleryResetField').addEventListener('click', () => {
    delete model().fields[selected]; get('galleryImage').value = '';
    syncPanel(); render(); status('بخش به نمونهٔ اصلی بازگشت.');
  });
  get('galleryImage').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file || exporting || loading) return;
    const targetModel = model(), id = selected;
    loading = true; render(); status('در حال آماده‌سازی تصویر…');
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw Error('عکس PNG، JPG یا WebP تا ۱۲ مگابایت انتخاب کن.');
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error('خواندن عکس ناموفق بود.')); reader.readAsDataURL(file);
      });
      const image = new Image(); image.src = src; await image.decode();
      if (image.naturalWidth * image.naturalHeight > 20000000) throw Error('ابعاد عکس بیش از حد بزرگ است؛ عکس کوچک‌تری انتخاب کن.');
      targetModel.fields[id] = { src }; status('عکس جایگزین شد.'); state.reference = false;
    } catch (error) { status(error.message || 'عکس قابل خواندن نیست.', true); }
    finally { loading = false; syncPanel(); render(); }
  });
  async function exportFile(type) {
    if (loading || exporting) return;
    state.reference = false; get('reference').textContent = 'نمایش مرجع'; render();
    if (state.layoutError) return;
    const p = template(), stage = document.createElement('div'), page = pageElement();
    exporting = true; render(); status('در حال ساخت خروجی…');
    stage.className = 'gallery-export-stage'; page.classList.add('exporting');
    page.querySelectorAll('.gallery-hit').forEach(hit => hit.remove()); stage.append(page); document.body.append(stage);
    try {
      await document.fonts.ready; await Promise.all([...page.querySelectorAll('img')].map(image => image.decode()));
      if (!fit(page)) throw Error('بخشی از متن در کادر جا نمی‌شود.');
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#fff', logging: false, width: p.width, height: p.height, windowWidth: Math.max(p.width, 1440), scrollX: 0, scrollY: 0 });
      const name = p.label.replace(/[<>:"/\\|?*]/g, '-');
      if (type === 'pdf') {
        const pdf = new jspdf.jsPDF({ unit: 'pt', format: [p.width * .75, p.height * .75], orientation: p.width > p.height ? 'landscape' : 'portrait', compress: true });
        pdf.addImage(canvas.toDataURL('image/jpeg', .98), 'JPEG', 0, 0, p.width * .75, p.height * .75); pdf.save(name + '.pdf');
      } else {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw Error('ساخت تصویر ناموفق بود.'); download(blob, name + '.png');
      }
      canvas.width = canvas.height = 0; status('خروجی آماده شد و در دانلودهای مرورگر قرار گرفت.');
    } catch (error) { status('خروجی ساخته نشد: ' + error.message, true); }
    finally { stage.remove(); exporting = false; render(); syncPanel(); }
  }
  new ResizeObserver(() => { if (template()) render(); }).observe(get('pages'));
  return { activate, leave, render, exportFile };
})();
