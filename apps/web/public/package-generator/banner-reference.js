'use strict';
// The supplied artwork remains the base. Editing a field replaces only its own region.
window.ReferenceBanners=(()=>{
 // html2canvas splits Persian words at ZWNJ and can place their runs in reverse order.
 // Use a word space for display; retain the user's original text in the editor model.
 const displayText=value=>esc(String(value??'').replace(/\u200c/g,' '));
 const rect=(cls,r,html='',attrs='',css='')=>`<div class="${cls}" style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;${css}" ${attrs}>${html}</div>`;
 const groupFor=(key,s)=>s.group||(key==='phone'||key==='address'||key.startsWith('feature')?'footer':'all');
 const changed=(key,s,m,p)=>s.always||m.background||m.dirty[key]||m.aligns[key]||m.aligns.all||m.fonts.all||m.fonts[groupFor(key,s)]||m.sizes[groupFor(key,s)]&&m.sizes[groupFor(key,s)]!==100||m.primary!==p.primary||m.accent!==p.accent;
 const overlaps=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
 const expand=(r,n)=>[r[0]-n,r[1]-n,r[2]+n*2,r[3]+n*2];
 function render({p,m,design,start,count,total,typeStyle,price,icon,applyAlignment}){
  const page=document.createElement('article');page.className='banner-page reference-banner '+design;
  page.style.cssText=`width:${p.width}px;height:${p.height}px;--banner-primary:${m.primary};--banner-accent:${m.accent};`;
  let html=`<img class="banner-base" src="${m.background||p.image}" alt="${esc(p.label)}">`;
  const clean=window.BANNER_REFERENCE_CLEAN_IMAGES?.[design],patches=[];
  const fields=new Set(),logos=new Set(),backed=s=>!!clean&&!s.always&&!s.solidBacking&&!m.background;
  const addField=(key,s)=>{fields.add(key);if(backed(s))patches.push(expand(s.clearRect||s.rect,['city','offer','english'].includes(key)?20:8));};
  const addLogo=key=>{logos.add(key);if(clean&&!m.background)patches.push(expand(p.logoBoxes[key],10));};
  for(const [key,s] of Object.entries(p.slots)){
   const extra=key==='airline'&&(m.dirty.flight||m.dirty.flightUnit||m.dirty.flightLabel)||key==='commission'&&m.dirty.commissionUnit||key==='country'&&m.dirty.english;
   if(extra||changed(key,s,m,p))addField(key,s);
  }
  for(const key of ['agency','airline'])if(m.background||m.logos[key]||!m.show[key]||m.scale[key]!==100)addLogo(key);
  if(p.featuresRect&&[...fields].some(key=>key.startsWith('feature'))&&clean&&!m.background)patches.push(p.featuresRect);
  // A mask can reach a neighbouring heading or logo. Redraw that neighbour as well,
  // so editing only the city cannot erase part of the original airline/Latin title.
  let added=true;
  while(added){
   added=false;
   for(const [key,s] of Object.entries(p.slots))if(!fields.has(key)&&patches.some(r=>overlaps(r,s.rect))){addField(key,s);added=true;}
   for(const key of ['agency','airline'])if(!logos.has(key)&&patches.some(r=>overlaps(r,p.logoBoxes[key]))){addLogo(key);added=true;}
  }
  for(const [key,s] of Object.entries(p.slots)){
   if(!fields.has(key))continue;
   let content=displayText(m.fields[key]||'');
   if(key==='date')content=displayText(prettyFa(m.fields.date)||'—');
   if(key==='commission')content=displayText(price(m.fields.commission,m.fields.commissionUnit));
   if(key==='airline')content=displayText('پرواز '+m.fields.airline)+(m.fields.flight?`<small>${displayText(m.fields.flightLabel+': '+price(m.fields.flight,m.fields.flightUnit))}</small>`:'');
   const color=s.tone==='gold'?'var(--banner-accent)':s.color||'var(--banner-primary)';
   html+=rect('reference-field '+(s.tone?'tone-'+s.tone:'')+(s.italic?' reference-italic':''),s.rect,`<span data-fit style="${typeStyle(groupFor(key,s),s.size)}">${content}</span>`,`data-banner-section="${key}"`,`background:${backed(s)?'transparent':s.fill};border-radius:${s.radius||0}px;color:${color};`);
  }
  for(const key of ['agency','airline']){
   if(!logos.has(key))continue;
   html+=rect('reference-logo',p.logoBoxes[key],m.show[key]?`<img src="${m.logos[key]||p.logos[key]}" alt="لوگوی ${key==='agency'?'آژانس':'ایرلاین'}" style="max-width:${m.scale[key]}%;max-height:${m.scale[key]}%">`:'','',`background:${clean||m.background?'transparent':'linear-gradient(115deg,#f7fcff,#e4f4fc)'};border-radius:12px;`);
  }
  for(let j=0;j<p.capacity;j++){
   const c=p.cards[j],h=j<count?m.hotels[start+j]:null,[x,y,w,height]=c.frame,local=r=>[r[0]-x,r[1]-y,r[2],r[3]];
   if(!h){html+=rect('reference-empty-card',[x+6,y+5,w-12,height-10],'','','border-radius:16px;background:'+c.emptyFill+';');continue;}
   let pieces='';
   if(p.cardStyle==='gold')pieces+=rect('reference-piece',local([c.name[0]-2,y+8,c.name[2]+4,70]),'','','background:'+c.nameFill+';');
   if(c.clear)pieces+=rect('reference-piece',local(c.clear),'','','background:'+c.priceFill+';');
   const label=(key,r,content,size,fill,color='var(--banner-primary)')=>rect('reference-piece reference-hotel-text',local(r),`<span data-fit style="${typeStyle(key==='hotelPrice'?'price':'hotel',size)}">${content}</span>`,`data-banner-section="${key}"`,`background:${fill};color:${color};border-radius:${key==='hotelPrice'?12:0}px;`);
   pieces+=label('hotelName',c.name,displayText(h.name),p.cardStyle==='postcard'?23:27,c.nameFill,c.nameColor);
   const star=h.stars?`<b class="reference-stars">${'★'.repeat(Math.max(0,Math.min(5,Number(h.stars)||0)))}</b>`:'';
   pieces+=label('hotelService',c.service,star+(h.service?' '+displayText(h.service):''),p.cardStyle==='sun'?23:16,c.nameFill,c.nameColor);
   pieces+=label('hotelPrice',c.price,displayText(price(h.price,h.unit)),p.cardStyle==='bodrum'?25:28,c.priceFill);
   if(h.photo)pieces+=rect('reference-hotel-photo',local(c.photo),`<img src="${h.photo}" alt="عکس ${esc(h.name)}" style="object-position:${h.photoX??50}% ${h.photoY??50}%">`);
   else if(!c.noSamplePhoto)pieces+=rect('reference-hotel-photo reference-photo-empty',local(c.photo),icon('hotel'));
   html+=rect('reference-hotel',c.frame,pieces,`data-banner-hotel="${start+j}" role="button" tabindex="0" aria-label="ویرایش ${esc(h.name)}"`);
  }
  if(clean&&patches.length){
   const mask=patches.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`).join('');
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${p.width}" height="${p.height}"><defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter><mask id="fields" maskUnits="userSpaceOnUse" x="0" y="0" width="${p.width}" height="${p.height}"><g filter="url(#soft)">${mask}</g></mask></defs><image width="${p.width}" height="${p.height}" xlink:href="${clean}" mask="url(#fields)"/></svg>`;
   html+=`<img class="reference-clean-overlay" src="data:image/svg+xml;base64,${btoa(svg)}" alt="لایهٔ زیر متن‌های ویرایش‌شده">`;
  }
  if(total>1)html+=`<span class="banner-page-number">${fa(Math.floor(start/p.capacity)+1)} / ${fa(total)}</span>`;
  page.innerHTML=html;applyAlignment(page);return page;
 }
 return {render};
})();
