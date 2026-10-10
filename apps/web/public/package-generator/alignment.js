'use strict';
// Physical left/right alignment stays consistent for Persian and Latin copy.
window.TextAlignment={
 options:(fallback='پیروی از چینش کل طرح')=>`<option value="">${fallback}</option><option value="left">چپ‌چین</option><option value="center">وسط‌چین</option><option value="right">راست‌چین</option>`,
 apply(el,value){
  if(!['left','center','right'].includes(value))return;
  el.dataset.textAlign=value;el.style.textAlign=value;
  // Unlike flex-start/flex-end, these positions do not reverse in RTL boxes.
  el.style.justifyContent=value;
 }
};
