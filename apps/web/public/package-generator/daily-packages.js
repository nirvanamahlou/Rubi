'use strict';

window.PackageDailyPublisher = (() => {
  let enabled = false;
  const buttons = [];
  const pending = new Map();
  const sync = () => buttons.forEach(({ button, exportButton }) => {
    button.hidden = !enabled;
    button.disabled = exportButton.disabled || pending.size > 0;
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent || window.parent === window) return;
    if (event.data?.type === 'rubi-daily-packages-enabled') { enabled = true; sync(); }
    if (event.data?.type !== 'rubi-daily-package-result') return;
    const item = pending.get(event.data.requestId);
    if (!item) return;
    pending.delete(event.data.requestId); clearTimeout(item.timer); sync();
    if (event.data.success === true) item.resolve();
    else item.reject(new Error(typeof event.data.message === 'string' ? event.data.message : 'ارسال پکیج انجام نشد.'));
  });
  return {
    register(id, action) {
      const exportButton = document.getElementById(id);
      if (!exportButton || window.parent === window) return;
      const actions = exportButton.closest('.actions');
      if (!actions) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'daily-output-actions';
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = 'ارسال به پکیج‌های روز';
      button.className = 'daily-package-publish'; button.hidden = true;
      actions.before(wrapper); wrapper.append(button, actions);
      buttons.push({ button, exportButton });
      new MutationObserver(sync).observe(exportButton, { attributes: true, attributeFilter: ['disabled'] });
      button.addEventListener('click', action); sync();
    },
    publish(blob, title) {
      if (!enabled || !(blob instanceof Blob) || blob.type !== 'application/pdf' || blob.size < 1 || blob.size > 25 * 1024 * 1024)
        return Promise.reject(new Error('خروجی پکیج برای ارسال معتبر نیست.'));
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId); sync(); reject(new Error('مهلت ارسال پکیج پایان یافت؛ دوباره تلاش کنید.'));
        }, 300000);
        pending.set(requestId, { resolve, reject, timer }); sync();
        window.parent.postMessage({ type: 'rubi-daily-package-publish', requestId, title: String(title).slice(0, 200), blob }, window.location.origin);
      });
    },
  };
})();
