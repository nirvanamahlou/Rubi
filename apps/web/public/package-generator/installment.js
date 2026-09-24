'use strict';
// Installment templates preserve the supplied artwork until a field is edited.
window.InstallmentBanners=(()=>{
 const display=value=>esc(String(value??'').replace(/\u200c/g,' '));
 const pos=r=>`left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;
 const expand=(r,n=5)=>[Math.max(0,r[0]-n),Math.max(0,r[1]-n),r[2]+n*2,r[3]+n*2];
 const groupFor=s=>s.group||(s.key==='phone'||s.key.startsWith('service')||s.key==='footerNote'?'footer':s.key==='city'||s.key==='offer'?'title':'all');
 function definitions(p){
  const rows=p.slots.map(s=>[s.key,p.labels[s.key]||s.key]);
  rows.push(['hotelName',`نام ${p.itemLabel||'کارت'}ها`]);
  if(p.cards.some(c=>c.service))rows.push(['hotelService',`توضیحات ${p.itemLabel||'کارت'}ها`]);
  if(p.cards.some(c=>c.price))rows.push(['hotelPrice',`قیمت ${p.itemLabel||'کارت'}ها`]);
  return rows;
 }
 function cleanPatch(p,r){
  const [x,y,w,h]=r;
  return `<div class="installment-clean-patch" style="${pos(r)}"><img src="${p.clean}" alt="" style="left:${-x}px;top:${-y}px;width:${p.width}px;height:${p.height}px"></div>`;
 }
 function textNode(s,value,typeStyle,index){
  const group=groupFor(s),attrs=index===undefined?'':`data-banner-hotel="${index}" role="button" tabindex="0" aria-label="ویرایش کارت ${index+1}"`;
  const color=s.color||'var(--banner-primary)',direction=s.ltr?'direction:ltr;':'';
  return `<div class="installment-field" data-banner-section="${s.key}" ${attrs} style="${pos(s.rect)}color:${color};text-align:${s.align||'center'};${direction}"><span data-fit style="${typeStyle(group,s.size)}font-weight:${s.weight||700}">${display(value)}</span></div>`;
 }
 function render({p,m,design,start,count,total,typeStyle,price,applyAlignment}){
  const forceAll=start>0||m.layoutDirty||!!m.background;
  const allStyles=!!m.fonts.all||!!m.fonts.title||!!m.fonts.hotel||!!m.fonts.price||!!m.fonts.footer||m.sizes.title!==100||m.sizes.hotel!==100||m.sizes.price!==100||m.sizes.footer!==100||m.primary!==p.primary||m.accent!==p.accent||!!m.aligns.all;
  const page=document.createElement('article');page.className='banner-page installment-page '+design;page.style.cssText=`width:${p.width}px;height:${p.height}px;--banner-primary:${m.primary};--banner-accent:${m.accent}`;
  let html=`<img class="banner-base" src="${m.background||(forceAll?p.clean:p.image)}" alt="${esc(p.label)}">`;
  const patches=[],nodes=[],photos=[];
  const fieldActive=s=>{const group=groupFor(s),size=m.sizes[group];return forceAll||allStyles||s.always||m.dirty[s.key]||m.aligns[s.key]||m.fonts[group]||size!==undefined&&size!==100;};
  for(const s of p.slots)if(fieldActive(s)){
   if(!forceAll)patches.push(expand(s.clearRect||s.rect,s.key==='city'||s.key==='offer'?10:5));
   nodes.push(textNode(s,m.fields[s.key],typeStyle));
  }
  for(let j=0;j<p.capacity;j++){
   const c=p.cards[j],h=j<count?m.hotels[start+j]:null,index=start+j;
   if(!h)continue;
   const redraw=forceAll||allStyles||h.dirty||m.aligns.hotelName||m.aligns.hotelService||m.aligns.hotelPrice||m.fonts.hotel||m.fonts.price||m.sizes.hotel!==100||m.sizes.price!==100;
   const attrs=`data-banner-hotel="${index}" role="button" tabindex="0" aria-label="ویرایش ${display(h.name)}"`;
   if(redraw){
    const cardSlots=[{key:'hotelName',rect:c.name,size:c.nameSize||21,group:'hotel',ltr:true,align:c.nameAlign||'center',value:h.name,color:c.nameColor},
     ...(c.service?[{key:'hotelService',rect:c.service,size:c.serviceSize||17,group:'hotel',value:h.service,color:c.serviceColor}]:[]),
     ...(c.price?[{key:'hotelPrice',rect:c.price,clearRect:c.priceClear,size:c.priceSize||28,group:'price',ltr:true,value:price(h.price,h.unit),color:c.priceColor}]:[]),
     ...(c.stars?[{key:'hotelService',rect:c.stars,size:c.starsSize||22,group:'hotel',ltr:true,value:'★'.repeat(Math.max(0,Math.min(5,Number(h.stars)||0))),color:c.starsColor||'#f0ad00'}]:[])];
    for(const s of cardSlots){if(!forceAll)patches.push(expand(s.clearRect||s.rect,3));nodes.push(textNode(s,s.value,typeStyle,index));}
   }else html+=`<div class="installment-hit" style="${pos(c.frame)}" ${attrs}></div>`;
   if(h.photo)photos.push(`<div class="installment-photo" style="${pos(c.photo)}" ${attrs}><img src="${h.photo}" alt="عکس ${display(h.name)}" style="object-position:${h.photoX??50}% ${h.photoY??50}%"></div>`);
   else if(h.photoRemoved)photos.push(`<div class="installment-empty-photo" style="${pos(c.photo)}" ${attrs}>＋</div>`);
  }
  for(const [key,r] of Object.entries(p.logoBoxes||{})){
   const visible=m.show[key]!==false,changed=forceAll||m.logos[key]||!visible||(m.scale[key]??100)!==100;
   if(!changed)continue;
   if(!forceAll)patches.push(expand(r,4));
   if(visible&&m.logos[key])nodes.push(`<div class="installment-logo" style="${pos(r)}"><img src="${m.logos[key]}" alt="لوگوی بارگذاری‌شده" style="max-width:${m.scale[key]??100}%;max-height:${m.scale[key]??100}%"></div>`);
  }
  if(!forceAll)html+=patches.map(r=>cleanPatch(p,r)).join('');
  html+=photos.join('')+nodes.join('');
  if(total>1)html+=`<span class="banner-page-number">${fa(Math.floor(start/p.capacity)+1)} / ${fa(total)}</span>`;
  page.innerHTML=html;applyAlignment(page);return page;
 }
 function reason(p,m){
  if(!m.hotels.length)return `با «افزودن ${p.itemLabel||'کارت'}» اولین مورد را بساز.`;
  const unnamed=m.hotels.findIndex(h=>!String(h.name||'').trim());if(unnamed>=0)return `نام ${p.itemLabel||'کارت'} ${fa(unnamed+1)} را وارد کن.`;
  const needsUnit=m.hotels.findIndex((h,i)=>p.cards[i%p.capacity]?.price&&String(h.price??'').trim()&&!h.unit);return needsUnit>=0?`ارز قیمت ${p.itemLabel||'کارت'} ${fa(needsUnit+1)} را انتخاب کن.`:'';
 }
 let api,extra,partner,currentCard;
 function mount(config){
  api=config;extra=document.createElement('section');extra.id='installmentFields';extra.hidden=true;extra.innerHTML='<h2>اطلاعات ویژهٔ بنر اقساطی</h2><p class="muted">همهٔ تیترها، شرایط، مزایا، خدمات، مسیرها و نوشته‌های پایین قالب از این بخش قابل تغییرند.</p>';
  const seen=new Set([...api.workspace.querySelectorAll('[data-banner-field]')].map(e=>e.dataset.bannerField));
  for(const p of Object.values(BANNER_TEMPLATES).filter(p=>p.installmentLayout))for(const s of p.slots)if(!seen.has(s.key)){seen.add(s.key);extra.insertAdjacentHTML('beforeend',`<label>${esc(p.labels[s.key]||s.key)}<textarea data-banner-field="${s.key}" rows="2" maxlength="400"></textarea></label>`);}
  document.getElementById('bannerAddHotel').closest('section').before(extra);
  partner=document.createElement('div');partner.id='installmentPartnerLogo';partner.hidden=true;partner.innerHTML='<label>لوگوی سوم / همکار<input data-banner-logo="partner3" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="layer-switch"><input data-banner-show="partner3" type="checkbox"> نمایش لوگوی سوم</label><label>اندازهٔ لوگوی سوم<input data-banner-scale="partner3" type="range" min="30" max="100" value="100"></label><button id="installmentPartnerReset" class="wide-button" type="button">لوگوی سوم نمونه</button>';
  document.getElementById('bannerBackground').closest('section').append(partner);
  document.getElementById('installmentPartnerReset').addEventListener('click',()=>{const m=api.model();delete m.logos.partner3;m.show.partner3=true;m.scale.partner3=100;sync(BANNER_TEMPLATES[window.BannerEditor?.design],m);api.render();});
 }
 function sync(p,m){
  const active=!!p.installmentLayout;extra.hidden=!active;partner.hidden=!active||!p.logoBoxes?.partner3;
  const section=document.getElementById('bannerAddHotel').closest('section');
  if(!active){section.querySelector('h2').innerHTML='<span>۰۳</span> هتل‌ها';document.getElementById('bannerAddHotel').textContent='＋ افزودن هتل';document.getElementById('hotelName').closest('label').firstChild.textContent='نام هتل';document.getElementById('hotelPhoto').closest('label').firstChild.textContent='بارگذاری عکس هتل';document.getElementById('hotelService').closest('label').firstChild.textContent='خدمات';document.getElementById('hotelService').placeholder='UALL / ALL / BB';for(const id of ['hotelStars','hotelService','hotelPrice','hotelUnit','hotelServiceAlign','hotelPriceAlign'])document.getElementById(id).closest('label').hidden=false;document.getElementById('hotelSave').textContent='ذخیرهٔ هتل';return;}
  if(m.show.partner3===undefined)m.show.partner3=true;if(m.scale.partner3===undefined)m.scale.partner3=100;
  const check=partner.querySelector('[data-banner-show=partner3]'),scale=partner.querySelector('[data-banner-scale=partner3]');check.checked=m.show.partner3;scale.value=m.scale.partner3;
  section.querySelector('h2').innerHTML=`<span>۰۳</span> ${p.itemPlural||'کارت‌ها'}`;document.getElementById('bannerAddHotel').textContent=`＋ افزودن ${p.itemLabel||'کارت'}`;
 }
 function openHotel(p,draft){
  if(!p.installmentLayout)return;currentCard=p.cards[(draft.index??0)%p.capacity];const label=p.itemLabel||'کارت';
  document.getElementById('hotelDialogTitle').textContent=(draft.index===undefined?'افزودن ':'ویرایش ')+label+(draft.index===undefined?'':' '+fa(draft.index+1));
  document.getElementById('hotelName').closest('label').firstChild.textContent=`نام ${label}`;document.getElementById('hotelPhoto').closest('label').firstChild.textContent=`بارگذاری عکس ${label}`;document.getElementById('hotelService').closest('label').firstChild.textContent='توضیحات / ویژگی‌ها';document.getElementById('hotelService').maxLength=220;document.getElementById('hotelService').placeholder='هر مورد را در یک خط بنویس';
  document.getElementById('hotelStars').closest('label').hidden=!currentCard.stars;document.getElementById('hotelService').closest('label').hidden=!currentCard.service;document.getElementById('hotelPrice').closest('label').hidden=!currentCard.price;document.getElementById('hotelUnit').closest('label').hidden=!currentCard.price;
  document.getElementById('hotelServiceAlign').closest('label').hidden=!currentCard.service&&!currentCard.stars;document.getElementById('hotelPriceAlign').closest('label').hidden=!currentCard.price;
  document.getElementById('hotelSave').textContent=`ذخیرهٔ ${label}`;
 }
 function closeHotel(){currentCard=null;}
 return {render,definitions,reason,mount,sync,openHotel,closeHotel};
})();
