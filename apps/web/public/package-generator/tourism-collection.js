'use strict';
window.TourismCollection=(()=>{
 const blankPhoto='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1122" height="1402"><rect width="1122" height="1402" fill="#e7eef2"/></svg>');
 const txt=v=>esc(String(v??'').replace(/\u200c/g,' '));
 const overlap=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
 const expand=(r,n=7)=>[r[0]-n,r[1]-n,r[2]+n*2,r[3]+n*2];
 const pos=r=>`left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;
 const labels={city:'عنوان اصلی',english:'عنوان لاتین',slogan:'شعار',country:'زیرعنوان لاتین',airline:'ایرلاین',date:'تاریخ حرکت',dateLabel:'عنوان تاریخ',tagline:'متن معرفی',phone:'تلفن',signoff:'متن پایانی',feature1:'خدمات اول',feature2:'خدمات دوم',feature3:'خدمات سوم'};
 function definitions(p){return [...new Map(Object.keys(p.fields).map(key=>[key,[key,p.labels[key]||labels[key]||key]])).values(),['hotelName','نام هتل‌ها'],['hotelPrice','قیمت و ارز هتل‌ها'],...(p.single?[['hotelDescription','معرفی هتل'],['hotelRoomType','نوع اتاق']]:[['hotelService','خدمات هتل‌ها']])];}
 function photo(src,shape,attrs='',x=50,y=50){
  if(!shape.path)return `<div class="collection-photo" style="${pos(shape.r)}border-radius:${shape.radius||0}px" ${attrs}><img src="${src}" alt="عکس انتخاب‌شده" style="object-position:${x}% ${y}%"></div>`;
  const r=shape.r,svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1122" height="1402"><defs><clipPath id="hero"><path d="${shape.path}"/></clipPath></defs><image x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" preserveAspectRatio="xMidYMid slice" xlink:href="${src}" clip-path="url(#hero)"/></svg>`;
  return `<img class="collection-hero-image" src="data:image/svg+xml;base64,${btoa(svg)}" alt="عکس اصلی با برش منحنی">`;
 }
 function render({p,m,design,start,count,total,typeStyle,price,applyAlignment}){
  const page=document.createElement('article');page.className='banner-page collection-page '+design;page.style.cssText=`width:1122px;height:1402px;--banner-primary:${m.primary};--banner-accent:${m.accent}`;
  let html=`<img class="banner-base" src="${m.background||p.image}" alt="${esc(p.label)}">`;
  const patches=[],skyPatches=new Set(),textNodes=[],photoNodes=[],clean=TOURISM_COLLECTION_CLEAN[design],allStyles=m.background||m.fonts.all||m.primary!==p.primary||m.accent!==p.accent;
  const activeSlots=new Set(),hotelSlots=[],cards=p.cards,primaryHero=p.single?m.hotels[start]?.photo:m.hero;
  const add=s=>{activeSlots.add(s);const sky=design==='antalya_13'&&s.key==='city',r=expand(s.r,sky?46:s.key==='city'?11:7);patches.push(r);if(sky)skyPatches.add(r);};
  const commonUnits=[...new Set(m.hotels.map(h=>h.unit).filter(Boolean))],currency=commonUnits.length===1?({'$':'دلار ($)','€':'یورو (€)'})[commonUnits[0]]||commonUnits[0]:'ارز درج‌شده';
  for(const s of p.slots)if(s.always||s.currencyCaption&&commonUnits.some(u=>u!=='تومان')||allStyles||m.dirty[s.key]||m.aligns[s.key]||m.aligns.all||m.fonts[s.group||'all']||m.sizes[s.group]&&m.sizes[s.group]!==100||primaryHero&&overlap(s.r,p.hero.r)||p.single&&s.key.startsWith('galleryCaption')&&m.hotels[start]?.galleryDirty?.[Number(s.key.slice(-1))-1])add(s);
  const put=(s,value,index)=>{
   const group=s.group||'all',color=s.color==='primary'||!s.color?'var(--banner-primary)':s.color==='accent'?'var(--banner-accent)':s.color;
   const attrs=index===undefined?'':`data-banner-hotel="${index}" role="button" tabindex="0" aria-label="ویرایش هتل ${index+1}"`;
   textNodes.push(`<div class="collection-text" data-banner-section="${s.key}" ${attrs} style="${pos(s.r)}color:${color};text-align:${s.align||'center'};${s.ltr?'direction:ltr;':''}"><span data-fit style="font-family:${s.font|| (s.key==='city'?"'B Titr',Tahoma":"Tahoma,Arial")};${typeStyle(group,s.size)};font-weight:${s.weight||700}">${txt(value)}</span></div>`);
  };
  for(let j=0;j<p.capacity;j++){
   const c=cards[j],h=j<count?m.hotels[start+j]:null,index=start+j;
   const attrs=`data-banner-hotel="${index}" role="button" tabindex="0" aria-label="ویرایش هتل ${index+1}"`;
   const rerender=!h||h.dirty||m.layoutDirty||start>0||allStyles||m.fonts.hotel||m.fonts.price||m.sizes.hotel!==100||m.sizes.price!==100||m.aligns.hotelName||m.aligns.hotelPrice||m.aligns.hotelService||m.aligns.hotelDescription||m.aligns.hotelRoomType||m.aligns.all||m.dirty.rateCaption;
   let nameRect=[...c.name];const optional=h?.photo&&c.optionalPhoto;
   if(optional){if(c.optionalPhoto[1]<c.name[1]+c.name[3]&&overlap(c.optionalPhoto,c.name)){const dx=c.optionalPhoto[0]+c.optionalPhoto[2]+10-nameRect[0];nameRect[0]+=dx;nameRect[2]-=dx;}}
   const hs=[{key:'hotelName',r:nameRect,clear:c.name,size:c.nameSize||40,font:c.font||'Arial',group:'hotel',ltr:true,align:'left',value:h?.name},
    {key:'hotelPrice',r:c.price,size:c.priceSize||55,font:c.font||'Arial',group:'price',ltr:true,color:c.priceColor||'primary',value:h?price(h.price,h.unit):''}];
   if(c.description)hs.push({key:'hotelDescription',r:c.description,size:c.descriptionSize||27,group:'hotel',value:h?.description});
   if(c.roomType)hs.push({key:'hotelRoomType',r:c.roomType,size:25,group:'hotel',value:h?.roomType});
   if(c.caption)hs.push({key:'hotelService',r:c.caption,size:25,group:'hotel',value:h?(m.fields.rateCaption||'نرخ هر نفر در اتاق دو تخته')+' | '+(({'$':'دلار ($)','€':'یورو (€)'})[h.unit]||h.unit):''});
   for(const s of hs){s.index=index;s.render=rerender||p.single&&s.key==='hotelPrice';hotelSlots.push(s);if(s.render)patches.push(expand(s.clear||s.r,2));}
   if(!p.single&&h&&!rerender)for(const r of [c.name,c.price])html+=`<div class="collection-hit" style="${pos(r)}" ${attrs}></div>`;
   if(p.single){
    if(h?.photo)photoNodes.push(photo(h.photo,p.hero,attrs,h.photoX,h.photoY));else if(h?.photoRemoved||start>0)photoNodes.push(photo(blankPhoto,p.hero,attrs));
    html+=`<div class="collection-hit" style="${pos(c.photo)}" ${attrs}></div>`;
    for(const [i,r] of c.gallery.entries()){
     if(h?.gallery?.[i]){if(h.galleryDirty?.[i]||start>0)photoNodes.push(photo(h.gallery[i],{r,radius:9},attrs));}
     else if(h?.galleryDirty?.[i]||start>0||!h)photoNodes.push(`<div class="collection-empty-photo" style="${pos(r)}" ${attrs}>عکس گالری ${i+1}</div>`);
     html+=`<div class="collection-hit" style="${pos(r)}" ${attrs}></div>`;
    }
   }else if(c.photo||optional){const r=c.photo||c.optionalPhoto;if(h?.photo)photoNodes.push(photo(h.photo,{r,radius:c.photoRadius||9},attrs,h.photoX,h.photoY));else photoNodes.push(`<div class="collection-empty-photo" style="${pos(r)}" ${h?attrs:''}></div>`);}
  }
  if(!p.single&&m.hero)photoNodes.push(photo(m.hero,p.hero));
  // Clear printed logo placeholders only on the two hotel sheets. Uploaded logos
  // in the list designs occupy their agency/airline area and keep their own aspect.
  for(const [key,r] of Object.entries(p.logos)){
   const uploaded=m.logos[key]&&m.show[key];
   if(p.single||uploaded)patches.push(expand(r,2));
   if(uploaded){for(const s of p.slots)if(overlap(s.r,r))add(s);html+=`<div class="collection-logo" style="${pos(r)}"><img src="${m.logos[key]}" style="max-width:${m.scale[key]}%;max-height:${m.scale[key]}%" alt="لوگوی ${key==='agency'?'آژانس':'ایرلاین'}"></div>`;}
  }
  // Feathered masks can cross neighbouring text. Redraw every affected neighbour.
  let added=true;while(added){added=false;for(const s of p.slots)if(!activeSlots.has(s)&&patches.some(r=>overlap(r,s.r))){add(s);added=true;}for(const s of hotelSlots)if(!s.render&&patches.some(r=>overlap(r,s.clear||s.r))){s.render=true;patches.push(expand(s.clear||s.r,2));added=true;}}
  if(design==='antalya_15'&&[...activeSlots].some(s=>s.key==='rateCaption'))html+='<div style="position:absolute;z-index:3;left:690px;top:643px;width:393px;height:72px;background:#fff"></div>';
  if(design==='hotel_h13'&&[...activeSlots].some(s=>s.key==='location'))html+='<div style="position:absolute;z-index:3;left:172px;top:132px;width:13px;height:61px;background:#fff"></div>';
  for(const s of activeSlots){const hiddenByLogo=Object.entries(p.logos).some(([key,r])=>m.logos[key]&&m.show[key]&&overlap(s.r,r));if(!hiddenByLogo)put(s,s.currencyCaption?m.fields[s.key]+' | '+currency:m.fields[s.key]);}
  for(const s of hotelSlots)if(s.render)put(s,s.value,s.index);
  if(patches.length){const mask=patches.map(r=>{const [x,y,w,h]=r;return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" ${skyPatches.has(r)?'filter="url(#skyBlend)"':''}/>`;}).join('');const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1122" height="1402"><defs><filter id="soft"><feGaussianBlur stdDeviation="2"/></filter><filter id="skyBlend" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="18"/></filter><mask id="patches" maskUnits="userSpaceOnUse" x="0" y="0" width="1122" height="1402"><g filter="url(#soft)">${mask}</g></mask></defs><image xlink:href="${m.background||clean}" width="1122" height="1402" preserveAspectRatio="none" mask="url(#patches)"/></svg>`;html+=`<img class="collection-clean" src="data:image/svg+xml;base64,${btoa(svg)}" alt="">`;}
  html+=photoNodes.join('')+textNodes.join('');if(total>1)html+=`<span class="banner-page-number">${fa(Math.floor(start/p.capacity)+1)} / ${fa(total)}</span>`;
  page.innerHTML=html;applyAlignment(page);return page;
 }
 let api,extra,heroSection,gallery,currentDraft=null,gallerySerial=0;
 function mount(config){api=config;extra=document.createElement('section');extra.id='collectionFields';extra.hidden=true;extra.innerHTML='<h2>اطلاعات ویژهٔ قالب گردشگری</h2>';
  const seen=new Set([...api.workspace.querySelectorAll('[data-banner-field]')].map(e=>e.dataset.bannerField));
  for(const p of Object.values(BANNER_TEMPLATES).filter(p=>p.collectionLayout))for(const key of Object.keys(p.fields)){const s={key};if(!seen.has(s.key)){seen.add(s.key);extra.insertAdjacentHTML('beforeend',`<label>${esc(p.labels[s.key]||labels[s.key]||s.key)}<textarea data-banner-field="${s.key}" rows="2" maxlength="300"></textarea></label>`);}}
  document.getElementById('bannerAddHotel').closest('section').before(extra);
  heroSection=document.createElement('div');heroSection.id='collectionHeroSection';heroSection.innerHTML='<label>عکس اصلی منظره<input id="collectionHeroUpload" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="collectionHeroReset">بازگرداندن منظرهٔ اصلی</button>';document.getElementById('bannerBackground').closest('label').before(heroSection);
  heroSection.addEventListener('change',e=>{const f=e.target.files?.[0];if(f){const m=api.model();api.track((async()=>{m.hero=await api.imageFile(f);})());}});document.getElementById('collectionHeroReset').addEventListener('click',()=>{api.model().hero='';document.getElementById('collectionHeroUpload').value='';api.render();});
  gallery=document.createElement('section');gallery.id='collectionHotelDetails';gallery.hidden=true;gallery.innerHTML='<h3>گالری و معرفی همین هتل</h3><label>معرفی هتل<textarea id="collectionDescription" rows="4" maxlength="650"></textarea></label><label>نوع اتاق<input id="collectionRoomType" maxlength="100"></label>'+['Description','RoomType'].map(k=>`<label>چینش ${k==='Description'?'معرفی هتل':'نوع اتاق'}<select id="collection${k}Align">${TextAlignment.options()}</select></label>`).join('')+[0,1].map(i=>`<div class="collection-gallery-editor"><b>عکس گالری ${i+1}</b><img id="collectionGalleryPreview${i}" alt="پیش‌نمایش عکس گالری"><input type="file" data-collection-gallery="${i}" accept="image/png,image/jpeg,image/webp"><button type="button" data-collection-gallery-remove="${i}">حذف عکس</button></div>`).join('');document.querySelector('#hotelForm .hotel-dialog-actions').before(gallery);
  gallery.addEventListener('change',e=>{if(e.target.dataset.collectionGallery===undefined||!e.target.files[0])return;const d=currentDraft,i=+e.target.dataset.collectionGallery,token=gallerySerial;api.track((async()=>{const src=await api.imageFile(e.target.files[0]);if(currentDraft===d&&token===gallerySerial){d.gallery[i]=src;d.galleryDirty[i]=true;previewGallery();}})());});
  gallery.addEventListener('click',e=>{const b=e.target.closest('[data-collection-gallery-remove]');if(b&&currentDraft){const i=+b.dataset.collectionGalleryRemove;gallerySerial++;currentDraft.gallery[i]='';currentDraft.galleryDirty[i]=true;previewGallery();}});
 }
 function previewGallery(){for(const i of [0,1]){const e=document.getElementById('collectionGalleryPreview'+i);e.src=currentDraft?.gallery?.[i]||'';e.hidden=!currentDraft?.gallery?.[i];}}
 function openHotel(p,d){gallerySerial++;currentDraft=d;gallery.hidden=!p.single;d.gallery||=[];d.galleryDirty||={};document.getElementById('collectionDescription').value=d.description||'';document.getElementById('collectionRoomType').value=d.roomType||'';for(const k of ['Description','RoomType'])document.getElementById('collection'+k+'Align').value=d.aligns?.[k]||'';for(const id of ['hotelStars','hotelService','hotelServiceAlign'])document.getElementById(id).closest('label').hidden=!!p.collectionLayout;document.getElementById('hotelPhotoRemove').textContent=p.single?'حذف عکس اصلی':'حذف عکس';previewGallery();}
 function saveHotel(p,d){if(p.single){d.description=document.getElementById('collectionDescription').value;d.roomType=document.getElementById('collectionRoomType').value;for(const k of ['Description','RoomType'])d.aligns[k]=document.getElementById('collection'+k+'Align').value;}}
 function closeHotel(){gallerySerial++;currentDraft=null;}
 function sync(p){extra.hidden=!p.collectionLayout;heroSection.hidden=!p.collectionLayout||p.single;api.workspace.classList.toggle('collection-mode',!!p.collectionLayout);document.getElementById('bannerTemplateHint').textContent=p.collectionLayout?(p.single?'هر هتل یک صفحه دارد؛ از فرم هتل عکس اصلی، دو عکس گالری، معرفی و قیمت را وارد کن.':'چهار هتل در هر صفحه؛ متن‌ها، نرخ‌ها و اطلاعات آژانس را ویرایش کن. قیمت‌های اولیه نمونه‌اند.'):document.getElementById('bannerTemplateHint').textContent;}
 return {render,mount,sync,definitions,openHotel,saveHotel,closeHotel};
})();
