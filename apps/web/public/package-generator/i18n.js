/* Offline localization adapter for the standalone legacy editor. Form values are untouched. */
(() => {
  const originalTitle = document.title;
  const catalog = window.RUBI_ENGLISH_UI || {};
  const phrases = Object.keys(catalog).sort((a, b) => b.length - a.length);
  let language = /(?:^|;\s*)nora-display-language=en(?:;|$)/.test(document.cookie) ? 'en' : 'fa';
  const digits = (text) => text.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)));
  const translate = (text) => {
    if (language !== 'en') return text;
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (catalog[normalized]) return digits((text.match(/^\s*/)?.[0] || '') + catalog[normalized] + (text.match(/\s*$/)?.[0] || '')); 
    let result = text;
    for (const source of phrases) if (result.includes(source)) result = result.split(source).join(catalog[source]);
    return digits(result);
  };
  const sources = new WeakMap();
  const attributes = new WeakMap();
  function update(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest('script,style,textarea,[contenteditable="true"]')) return;
      const previous = sources.get(root);
      const original = previous && root.data === previous.rendered ? previous.original : root.data;
      const rendered = translate(original);
      sources.set(root, { original, rendered });
      if (root.data !== rendered) root.data = rendered;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const saved = attributes.get(root) || {};
    for (const name of ['title', 'placeholder', 'alt', 'aria-label']) {
      const current = root.getAttribute(name);
      if (current === null) continue;
      const previous = saved[name];
      const original = previous && current === previous.rendered ? previous.original : current;
      const rendered = translate(original);
      saved[name] = { original, rendered };
      if (current !== rendered) root.setAttribute(name, rendered);
    }
    attributes.set(root, saved);
    for (const child of root.childNodes) update(child);
  }
  function refresh() {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    update(document.body);
    document.title = translate(originalTitle);
  }
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) update(node);
      else update(record.target);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'alt', 'aria-label'] });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (event.data?.type !== 'rubi-display-language' || !['fa', 'en'].includes(event.data.language)) return;
    language = event.data.language;
    refresh();
  });
  for (const method of ['fillText', 'strokeText']) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function(text, ...args) { return original.call(this, translate(String(text)), ...args); };
  }
  for (const method of ['alert', 'confirm']) {
    const original = window[method].bind(window);
    window[method] = (text) => original(translate(String(text)));
  }
  refresh();
})();
