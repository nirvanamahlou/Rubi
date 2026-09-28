'use strict';
const $=id=>document.getElementById(id),state={data:null,bytes:null,fileName:'',cards:{},reference:false,busy:false,importId:0,layoutError:false,templatePinned:false},artworkCache=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>new Intl.NumberFormat('fa-IR').format(n),latin=s=>String(s).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)),profile=()=>window.PackageCards?.profile(TEMPLATES[$('template').value])||TEMPLATES[$('template').value];
const TEMPLATE_COUNTRIES={
 turkey:['combined','kus','antalya','bodrum','nss'],
 malaysia:['malaysia-kuala','malaysia-penang','malaysia-singapore','malaysia-langkawi'],
 spain:['spain-barcelona','spain-madrid','spain-combined'],
 thailand:['thailand-phuket','thailand-bangkok-phuket','thailand-pattaya']
};
function countryForTemplate(templateId){return Object.entries(TEMPLATE_COUNTRIES).find(([,templateIds])=>templateIds.includes(templateId))?.[0];}
function syncTemplateOptions(country,preferredTemplate){
 const templateIds=(TEMPLATE_COUNTRIES[country]||TEMPLATE_COUNTRIES.turkey).filter(templateId=>TEMPLATES[templateId]);
 $('template').replaceChildren(...templateIds.map(templateId=>new Option(TEMPLATES[templateId].label,templateId)));
 const selectedTemplate=templateIds.includes(preferredTemplate)?preferredTemplate:templateIds[0];$('template').value=selectedTemplate;return selectedTemplate;
}
function syncTemplateCountry(templateId){
 const country=countryForTemplate(templateId)||$('templateCountry').value;$('templateCountry').value=country;return syncTemplateOptions(country,templateId);
}
function message(t,error=false){
 $('status').textContent=t;$('status').className=error?'error':'';state.lastError=error?t:'';
 const output=$('downloadStatus');if(output){output.textContent=t;output.classList.toggle('error',error);output.hidden=!error&&!state.busy;}
 updateDownloadNotice();
}
function unavailable(v){return v===''||v==null||/^(n\/?a|#n\/a|—|-)$/i.test(String(v).trim());}
function prettyFa(t){return String(t||'').replace(/([0-9۰-۹])(\p{L})/gu,'$1 $2').replace(/(\p{L})([0-9۰-۹])/gu,'$1 $2').replace(/[0-9]/g,c=>'۰۱۲۳۴۵۶۷۸۹'[c]);}
function priceText(c){
 if(!c||unavailable(c.value))return '—';let currency=c.currency||$('unit').value,v=c.value;
 if(typeof v==='string'){const found=v.match(/€|\$|تومان|ریال|یورو|دلار/);if(found)currency=found[0].replace('یورو','€').replace('دلار','$');const clean=latin(v).replace(/€|\$|تومان|ریال|یورو|دلار/g,'').trim();if(/^\d{1,3}([.,/٬]\d{3})+$/.test(clean))v=Number(clean.replace(/[.,/٬]/g,''));else if(/^\d+(\.\d+)?$/.test(clean))v=Number(clean);}
 const a=typeof v==='number'?new Intl.NumberFormat('en-US',{minimumFractionDigits:0,maximumFractionDigits:c.decimals??2}).format(v):String(v).trim();const priced=currency?(['€','$'].includes(currency)?currency+' '+a:a+' '+currency):a;return priced+(c.suffix?' '+c.suffix:'');
}
function moneyText(v){if(unavailable(v))return '—';const n=PackageSummary.money(v);if(n===null)return String(v).trim();return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).formatToParts(n).map(p=>p.type==='group'?'.':p.type==='decimal'?'٫':p.value).join('');}
function defaultServices(){return $('template').value==='nss'?'پرواز رفت و برگشت ایران ایرتور، ترانسفر فرودگاهی، راهنمای فارسی‌زبان، اقامت در هتل با خدمات درج‌شده، بیمه مسافرتی، سیم‌کارت، گشت شهری با ناهار و ترانسفر رفت و برگشت هتل بازار جواهر آنتالیا.':'پرواز رفت و برگشت ایران ایرتور، ترانسفر فرودگاهی، راهنمای فارسی‌زبان، اقامت در هتل با خدمات درج‌شده، بیمه مسافرتی';}
function columns(){
 const p=profile(),d=state.data,cols=[{key:'hotel',label:'نام هتل'}];if(p.style==='combined')cols.push({key:'city',label:'شهر'});if(p.style==='spain-combined')cols.push({key:'stars',label:'ستاره'});if((d.hasRoom&&p.style!=='combined')||p.style==='antalya')cols.push({key:'room',label:'نوع اتاق'});cols.push({key:'service',label:'خدمات'});
 for(const key of d.priceKeys)cols.push({key,label:{double:'دوتخته',single:'یک تخت',extra:'اضافه',child:'کودک با تخت',small:p.style.startsWith('malaysia-')?'کودک بدون تخت':'کودک ۲–۶ سال'}[key]});
 if(cols.length===p.columns.length)cols.forEach((c,i)=>c.width=p.columns[i]);else{let rem=100;for(const c of cols){if(c.key==='hotel')c.width=30;if(c.key==='room')c.width=22;if(c.key==='city')c.width=12;if(c.key==='service')c.width=12;if(c.width)rem-=c.width;}const rest=cols.filter(c=>!c.width);rest.forEach(c=>c.width=rem/rest.length);}return cols;
}
function headerBox(){return profile().headerBox||{combined:[216,271,879,37],antalya:[212,234,879,31],kus:[247,264,849,38],bodrum:[238,286,740,40],nss:[238,282,750,31]}[profile().style];}
function hasCustomTitle(){return window.PackageEditor?.needs('title')||PKJ.norm($('title').value)!==PKJ.norm(profile().title);}
function servicesText(){if(profile().style.startsWith('spain-'))return $('services').value;if(window.PackageEditor?.needs('services'))return [$('services').value||((window.PackageEditor?.hasText('services'))?'':defaultServices()),$('notes').value].filter(Boolean).join('\n');return [$('services').value||($('notes').value?defaultServices():''),$('notes').value].filter(Boolean).join('\n');}
const LAYER_GEOMETRY={
 combined:{left:[0,0,233,1324],agency:[239,10,154,180],airline:[916,8,176,172],footer:[0,1324,1122,78]},
 kus:{left:[0,0,258,1253],agency:[263,10,185,180],airline:[892,8,180,180],footer:[0,1253,1145,121]},
 antalya:{left:[0,0,232,1328],agency:[242,9,177,163],airline:[906,9,174,165],footer:[0,1328,1122,74]},
 bodrum:{left:[0,0,237,1445],agency:[242,10,171,185],airline:[832,10,174,184],footer:[0,1445,1024,91]},
 nss:{left:[0,0,233,1409],agency:[238,4,182,196],airline:[851,12,157,208],footer:[0,1409,1055,82]},
 'malaysia-kuala':{left:[0,0,177,1197],agency:[198,8,142,151],airline:[676,8,153,151],footer:[0,1197,854,83]},
 'malaysia-penang':{left:[0,0,185,1197],agency:[198,8,151,151],airline:[830,8,151,151],footer:[0,1197,1024,83]},
 'malaysia-singapore':{left:[0,0,194,1198],agency:[208,8,152,151],airline:[783,8,151,151],footer:[0,1198,960,82]},
 'malaysia-langkawi':{left:[0,0,145,1008],agency:[155,7,126,128],airline:[585,7,125,128],footer:[0,1008,720,72]},
 'thailand-phuket':{left:[0,0,154,1008],agency:[158,3,151,143],airline:[612,3,149,145],footer:[0,1008,771,72]},
 'thailand-bangkok-phuket':{left:[0,0,151,1008],agency:[154,3,151,143],airline:[614,3,142,145],footer:[0,1008,764,72]},
 'thailand-pattaya':{left:[0,0,137,1021],agency:[141,3,143,142],airline:[568,3,145,143],footer:[0,1021,720,59]},
 'spain-barcelona':{left:[0,0,160,1514],agency:[191,55,179,197],airline:[764,135,174,165],footer:[0,1514,948,145]},
 'spain-madrid':{left:[0,0,175,1515],agency:[192,59,180,196],airline:[765,121,173,174],footer:[0,1515,948,144]},
 'spain-combined':{left:[0,0,152,1517],agency:[190,58,180,196],airline:[767,155,171,155],footer:[0,1517,948,142]}
};
function staticArt(){
 const p=profile(),holes=state.data?[p.body,p.date,...p.cardSlots.map(s=>s.box)]:[];holes.push(...(window.PackageEditor?.holes()||[]),...(window.PackageCards?.holes()||[]));if(p.style==='combined'&&(state.data||$('stays').value||['stays','infant','infantLabel','infantValue','infantUnit'].some(k=>window.PackageEditor?.needs(k))))holes.push(p.staysBox,p.infantBox);if(hasCustomTitle())holes.push(p.titleBox);if(p.durationBox&&state.data)holes.push(p.durationHole||p.durationBox);if(servicesText())holes.push(p.servicesBox);if(p.notesBox&&state.data)holes.push(p.notesBox);if(p.adjustmentsBox&&state.data)holes.push(p.adjustmentsBox);if(state.data&&(columns().length!==p.columns.length||window.PackageEditor?.customHeader()))holes.push(headerBox());
 const key=$('template').value+JSON.stringify(holes);if(artworkCache.has(key))return artworkCache.get(key);
 if(p.externalImage){
  const fillFor=box=>{
   if(p.date&&box===p.date)return '#062b7d';
   if(p.headerBox&&box===p.headerBox)return '#062b7d';
   return '#fff';
  };
  const svgRect=(w,h,fill)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;
  const result=[{key:'background',label:'زمینهٔ قالب',box:[0,0,p.width,p.height],src:p.image},...holes.map((box,i)=>({key:'mask-'+i,label:'زمینهٔ قابل ویرایش',box,src:'data:image/svg+xml;base64,'+btoa(svgRect(box[2],box[3],fillFor(box)))}))];
  artworkCache.set(key,result);return result;
 }
 const geo=LAYER_GEOMETRY[p.style],layers=[{key:'left',label:'عکس چپ و انحنا',box:geo.left},{key:'agency',label:'لوگوی آژانس',box:geo.agency},{key:'airline',label:'لوگوی ایرلاین',box:geo.airline},{key:'city',label:'عنوان شهر',box:p.titleBox},{key:'footer',label:'فوتر اصلی',box:geo.footer}];if(p.noteIconBox)layers.push({key:'noteIcon',label:'آیکون توضیحات',box:p.noteIconBox});if(p.serviceIconBox)layers.push({key:'serviceIcon',label:'آیکون خدمات',box:p.serviceIconBox});
 const full={key:'background',label:'زمینه، خطوط و سکشن‌ها',box:[0,0,p.width,p.height]};
 const result=[full,...layers].map(layer=>{
  const removed=layer.key==='background'?[...holes,...layers.map(l=>l.box)]:layer.key==='airline'&&p.durationHole?holes.filter(h=>h!==p.durationHole):layer.key==='noteIcon'?holes.filter(h=>h!==p.notesBox):layer.key==='serviceIcon'?holes.filter(h=>h!==p.servicesBox):holes;
  const rects=removed.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>`).join('');
  const [x,y,w,h]=layer.box;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs><mask id="slots" maskUnits="userSpaceOnUse" x="0" y="0" width="${p.width}" height="${p.height}"><rect width="${p.width}" height="${p.height}" fill="white"/>${rects}</mask></defs><image width="${p.width}" height="${p.height}" xlink:href="${p.image}" mask="url(#slots)"/></svg>`;
  return {...layer,src:'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))};
 });
 if(artworkCache.size>5)artworkCache.clear();artworkCache.set(key,result);return result;
}
function place(cls,box,html){const [x,y,w,h]=box;return `<div class="${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${html}</div>`;}
function edit(t,a){return `<span class="editable" contenteditable="true" role="textbox" tabindex="0" spellcheck="false" ${a}>${esc(t)}</span>`;}
function hotelLimit(){const p=profile();return $('perPage').value==='auto'?p.rows*(p.tableColumns||1):Math.max(1,Math.min(100,Number($('perPage').value)||50));}
function splitTableColumns(ids,count){
 if(count<=1)return [ids];const total=ids.reduce((sum,i)=>sum+state.data.groups[i].hotels.length,0),target=Math.ceil(total/count),parts=[];let part=[],rows=0;
 for(const i of ids){const size=state.data.groups[i].hotels.length;if(part.length&&rows+size>target&&parts.length<count-1){parts.push(part);part=[];rows=0;}part.push(i);rows+=size;}parts.push(part);while(parts.length<count)parts.push([]);return parts;
}
function rowsHTML(ids,minimumRows=profile().rows){
 const cols=columns();let html='';for(const i of ids){const g=state.data.groups[i];g.hotels.forEach((h,hi)=>{html+='<tr class="data-row">';for(const c of cols){
  if(state.data.priceKeys.includes(c.key)){if(hi===0)html+=`<td class="price" rowspan="${g.hotels.length}">${edit(priceText(g.prices[c.key]),`data-group="${i}" data-price="${c.key}" aria-label="${esc(c.label)}"`)}</td>`;}
  else if(c.key==='service')html+=`<td class="service">${edit((h.stars&&profile().style!=='spain-combined'?h.stars+(h.service?' / ':''):'')+h.service,`data-group="${i}" data-hotel="${hi}" data-key="service" aria-label="خدمات هتل"`)}</td>`;
  else if(c.key==='hotel'&&profile().style.startsWith('spain-')){const p=profile(),box=p.thumbnailBoxes?.[i]||p.thumbnailBoxes?.at(-1),photo=box?`<span class="hotel-thumb" style="width:${box[2]}px;height:${box[3]}px;background-image:url('${p.image}');background-size:${p.width}px ${p.height}px;background-position:-${box[0]}px -${box[1]}px"></span>`:'';html+=`<td class="hotel"><div class="hotel-wrap">${photo}${edit(h.hotel||'—',`data-group="${i}" data-hotel="${hi}" data-key="hotel" aria-label="نام هتل"`)}</div></td>`;}
  else html+=`<td class="${c.key}">${edit(h[c.key]||'—',`data-group="${i}" data-hotel="${hi}" data-key="${c.key}" aria-label="${esc(c.label)}"`)}${c.key==='hotel'&&g.hotels.length>1&&profile().style!=='combined'?`<small class="city-note">${esc(h.city)}</small>`:''}</td>`;
 }html+='</tr>';});}
 const count=ids.reduce((s,i)=>s+state.data.groups[i].hotels.length,0);for(let n=count;n<minimumRows;n++)html+='<tr class="empty-row" aria-hidden="true">'+cols.map(()=>'<td></td>').join('')+'</tr>';return html;
}
function makePage(ids,num,total){
 const p=profile(),cols=state.data?columns():[],tableGroups=state.data?splitTableColumns(ids,p.tableColumns||1):[],page=document.createElement('article');page.className='package-page '+p.style;page.style.width=p.width+'px';page.style.height=p.height+'px';page.style.setProperty('--table-color',$('tableColor').value);
 if(state.data&&Math.max(...tableGroups.map(group=>group.reduce((n,i)=>n+state.data.groups[i].hotels.length,0)))>p.rows)page.classList.add('dense-table');
 let html=staticArt().map(layer=>{const [x,y,w,h]=layer.box;return `<img class="template-art" data-layer="${layer.key}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" src="${layer.src}" alt="${layer.label}">`;}).join('');
 if(state.data){const boxes=p.bodyColumns||[p.body];html+=tableGroups.map((group,index)=>place(`data-region data-region-${index+1}`,boxes[index],`<table class="data-table" style="font-size:${$('fontSize').value}px" aria-label="قیمت هتل‌ها${tableGroups.length>1?'، ستون '+fa(index+1):''}"><colgroup>${cols.map(c=>`<col style="width:${c.width}%">`).join('')}</colgroup><tbody>${rowsHTML(group,p.rows)}</tbody></table>`)).join('');}
 if(state.data||window.PackageEditor?.needs('date'))html+=place('date-slot',p.date,esc(prettyFa($('date').value)||(window.PackageEditor?.hasText('date')?'':'—')));if(p.durationBox&&(state.data||window.PackageEditor?.needs('duration')))html+=place('duration-slot',p.durationBox,esc(prettyFa($('duration').value).replace(/[()]/g,'')));if(hasCustomTitle())html+=place('title-slot',p.titleBox,esc($('title').value));
 if(p.style==='combined'&&(state.data||$('stays').value||['stays','infant','infantLabel','infantValue','infantUnit'].some(k=>window.PackageEditor?.needs(k)))){html+=place('stays-slot',p.staysBox,esc(prettyFa($('stays').value)));html+=place('infant-slot',p.infantBox,`<span>${esc($('infantLabel').value)}:</span> <b>${esc(moneyText($('infantValue').value))}</b> <small>${esc($('infantValue').value?$('infantUnit').value:'')}</small>`);}
 html+=window.PackageCards?.artwork()||'';
 for(const slot of p.cardSlots){if(!state.data&&!window.PackageEditor?.needs('value_'+slot.key)&&!window.PackageEditor?.needs('unit_'+slot.key))continue;const c=state.cards[slot.key]||{};html+=place('value-slot value-'+slot.key,slot.box,`<b>${esc(p.style.startsWith('spain-')?prettyFa(moneyText(c.value)):moneyText(c.value))}</b>${!unavailable(c.value)?`<small>${esc(window.PackageEditor?.hasText('unit_'+slot.key)?(c.unit??''):(c.unit??'تومان'))}</small>`:''}`);}
 if(servicesText())html+=place('services-slot',p.servicesBox,esc(servicesText()));
 if(p.notesBox&&state.data)html+=place('notes-slot',p.notesBox,esc($('notes').value||'—'));
 if(p.adjustmentsBox&&state.data)html+=place('adjustments-slot',p.adjustmentsBox,esc(prettyFa($('adjustments').value)||'—'));
 if(state.data&&(cols.length!==p.columns.length||window.PackageEditor?.customHeader()))html+=(p.headerBoxes||[headerBox()]).map(box=>place('custom-header',box,cols.map(c=>`<span data-section="header_${c.key}" style="width:${c.width}%">${esc(window.PackageEditor?.text('header_'+c.key,c.label)??c.label)}</span>`).join(''))).join('');
 if(total>1)html+=`<div class="page-stamp">${fa(num)} / ${fa(total)}</div>`;page.innerHTML=html+(window.PackageEditor?.overlays()||'');window.PackageEditor?.decorate(page);return page;
}
function fitText(page){
 const region=page.querySelector('.data-region'),table=region?.querySelector('table');
 const rowCount=table?.rows.length||1,tableStyle=table&&getComputedStyle(table),spacing=tableStyle?.borderCollapse==='collapse'?0:parseFloat(tableStyle?.borderSpacing.split(' ').at(-1)||0);
 const rowHeight=region?(region.clientHeight-spacing*(rowCount+1))/rowCount:0,minSize=profile().minFont||8;
 for(const el of page.querySelectorAll('.data-table [contenteditable]')){
  let size=Number(el.dataset.editorSize||$('fontSize').value);if(el.closest('.room')&&!el.dataset.editorSize)size=Math.min(size,12);el.style.fontSize=size+'px';
  const cell=el.closest('td'),style=getComputedStyle(cell),lineRatio=parseFloat(getComputedStyle(el).lineHeight)/size||1.16,note=cell.querySelector('.city-note');
  const available=rowHeight*cell.rowSpan-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth)-(note?.offsetHeight||0);
  size=Math.max(minSize,Math.min(size,Math.floor(available/lineRatio*4)/4));el.style.fontSize=size+'px';
  for(let n=0;n<160&&el.scrollWidth>el.clientWidth+1&&size>minSize;n++){size=Math.max(minSize,size-.25);el.style.fontSize=size+'px';}
 }
 for(const el of page.querySelectorAll('.title-slot,.date-slot,.duration-slot,.stays-slot,.infant-slot,.services-slot,.notes-slot,.adjustments-slot,.value-slot b,.value-slot small,.editor-text,.custom-header span')){let size=parseFloat(getComputedStyle(el).fontSize);for(let n=0;n<65&&(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2)&&size>11;n++){size-=1;el.style.fontSize=size+'px';}}
 return [...page.querySelectorAll('.data-region')].every(item=>item.querySelector('table').getBoundingClientRect().height<=item.getBoundingClientRect().height+2)&&[...page.querySelectorAll('.date-slot,.title-slot,.stays-slot,.infant-slot,.services-slot,.notes-slot,.adjustments-slot,.value-slot,.editor-text,.custom-header span')].every(e=>e.scrollWidth<=e.clientWidth+2&&e.scrollHeight<=e.clientHeight+2);
}
function unmarkedPrices(){return state.data?.groups.some(g=>Object.values(g.prices).some(c=>!unavailable(c.value)&&!c.currency&&!/€|\$|تومان|ریال|یورو|دلار/.test(String(c.value))))||false;}
function updateDownloadNotice(){
 const notice=$('downloadNotice');if(!notice)return;
 const currencyNeeded=unmarkedPrices()&&!$('unit').value,pending=!!window.PackageEditor?.pending,reasons=[];
 if(!state.data)reasons.push(state.lastError?'فایل منبع وارد نشده است؛ پیام خطا را در همین بخش بررسی کن.':'برای دانلود، ابتدا فایل اکسل یا Word را انتخاب کن.');
 else if(state.busy)reasons.push('در حال ساخت فایل؛ چند لحظه صبر کن…');
 else if(pending)reasons.push('در حال آماده‌سازی فونت و تصاویر…');
 else{
  if(currencyNeeded)reasons.push('برای فعال شدن دانلود، واحد قیمت‌های بدون نماد را انتخاب کن.');
  if(state.layoutError)reasons.push('بخشی از متن در کادر جا نمی‌شود. اندازهٔ متن یا طول آن را کمتر کن.');
 }
 $('downloadReason').textContent=reasons.join(' ');notice.hidden=!reasons.length;
 $('downloadCurrencyLabel').hidden=!state.data||!currencyNeeded||state.busy;
 $('downloadUnit').value=$('unit').value;$('downloadUnit').disabled=state.busy||!state.data;
 $('downloadFixLayout').hidden=!state.data||!state.layoutError||state.busy;
 notice.classList.toggle('needs-input',!!state.data&&!state.busy&&(currencyNeeded||state.layoutError));
}
function showLayoutIssue(){
 const elements=[...document.querySelectorAll('.package-page .date-slot,.package-page .title-slot,.package-page .services-slot,.package-page .value-slot,.package-page .editor-text,.package-page .custom-header span')].filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2);
 for(const region of document.querySelectorAll('.data-region'))if(region.querySelector('table').getBoundingClientRect().height>region.getBoundingClientRect().height+2)elements.push(region);
 const target=elements[0];for(const el of elements)el.classList.add('layout-issue');
 if(target){target.scrollIntoView({block:'center',behavior:'smooth'});if(target.dataset.section&&[...$('textSection').options].some(o=>o.value===target.dataset.section)){$('textSection').value=target.dataset.section;$('textSection').dispatchEvent(new Event('change'));}}
}
function updateWarnings(){
 const warnings=[...(state.data?.warnings||[])],unknown=unmarkedPrices();

 const missing=state.data?profile().cardSlots.filter(s=>unavailable(state.cards[s.key]?.value)).map(s=>window.PackageCards?.title(s)??s.label):[];if(missing.length)warnings.push('این مبالغ در شیت منبع نبودند و با «—» نمایش داده می‌شوند: '+missing.join('، '));if(state.layoutError)warnings.push('بخشی از متن در فضای قالب جا نمی‌شود؛ اندازهٔ متن یا تعداد گزینه‌ها را کاهش بده.');
 $('warnings').replaceChildren(...warnings.map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));const blocked=!state.data||state.busy||window.PackageEditor?.pending||state.layoutError||unknown&&!$('unit').value;$('png').disabled=blocked;$('pdf').disabled=blocked;updateDownloadNotice();
}
function drawCards(){return ScrollPosition.keep(()=>drawCardsContents());}
 function drawCardsContents(){
 const host=$('cards');host.replaceChildren();for(const slot of profile().cardSlots){
  const v=state.cards[slot.key]||{value:'',unit:'تومان'},label=window.PackageCards?.title(slot)??slot.label,div=document.createElement('div');div.className='card-edit';
  div.innerHTML=`<div class="card-edit-head"><label for="card-title-${slot.key}">عنوان کادر</label><button type="button" data-remove-card="${slot.key}" aria-label="حذف کادر ${esc(label)}">حذف</button></div><input id="card-title-${slot.key}" data-card-title="${slot.key}" aria-label="عنوان کادر ${esc(slot.label)}" value="${esc(label)}" maxlength="100"><div class="two"><input data-card="${slot.key}" aria-label="مبلغ ${esc(label)}" value="${esc(v.value)}" placeholder="درج نشده" dir="ltr"><select data-card-unit="${slot.key}" aria-label="واحد ${esc(label)}"><option>تومان</option><option>ریال</option><option value="€">یورو</option><option value="$">دلار</option></select></div><small>${v.ref&&state.data?'منبع: '+esc(state.data.sheetName)+'!'+esc(v.ref):'قابل تکمیل دستی'}</small>`;
  const select=div.querySelector('select'),unit=v.unit??'تومان';if(![...select.options].some(o=>o.value===unit))select.add(new Option(unit||'بدون واحد',unit));select.value=unit;host.append(div);
  if(v.normalization){const note=document.createElement('small');note.textContent='گروه‌بندی اصلاح‌شده: '+v.normalization.original+' ← '+v.normalization.corrected;div.append(note);}
 }
 window.PackageCards?.syncTitles();
}
function render(){return ScrollPosition.keep(()=>renderContents());}
 function renderContents(){
 $('combinedFields').hidden=profile().style!=='combined';const host=$('pages');host.replaceChildren();host.classList.toggle('show-layers',!!$('showLayers')?.checked);state.layoutError=false;const p=profile(),scale=Math.min(1,Math.max(280,host.clientWidth-4)/p.width);
 if(state.reference||(!state.data&&!window.PackageEditor)){const img=document.createElement('img');img.src=p.image;img.className='reference-image';img.alt='مرجع '+p.label;img.style.maxWidth=p.width+'px';host.append(img);if(!state.data)$('summary').textContent='نمایش مرجع؛ برای جایگزینی قیمت‌ها اکسل یا Word را وارد کن.';updateWarnings();return;}
 if(!state.data){const page=makePage([],1,1),wrap=document.createElement('div'),zoom=document.createElement('div');wrap.className='page-wrap';wrap.style.width=p.width*scale+'px';wrap.style.height=p.height*scale+'px';zoom.className='page-scale';zoom.style.transform=`scale(${scale})`;zoom.append(page);wrap.append(zoom);host.append(wrap);fitText(page);$('summary').textContent='پیش‌نمایش قالب؛ برای ساخت خروجی، اکسل یا Word را وارد کن.';window.PackageEditor?.sync();updateWarnings();return;}
 const chunks=[];let chunk=[],rows=0;const limit=hotelLimit();for(let i=0;i<state.data.groups.length;i++){const count=state.data.groups[i].hotels.length;if(chunk.length&&rows+count>limit){chunks.push(chunk);chunk=[];rows=0;}chunk.push(i);rows+=count;}if(chunk.length)chunks.push(chunk);
 // Reflow groups using their actual rendered height; paired hotels remain together.
 for(let ci=0;ci<chunks.length;ci++){
  const moved=[];
  while(chunks[ci].length>1){
   const trial=makePage(chunks[ci],1,1);host.append(trial);fitText(trial);
   const region=trial.querySelector('.data-region');const fits=region.querySelector('table').getBoundingClientRect().height<=region.getBoundingClientRect().height+2;
   trial.remove();if(fits)break;moved.unshift(chunks[ci].pop());
  }
  if(moved.length)chunks.splice(ci+1,0,moved);
 }
 chunks.forEach((ids,n)=>{const page=makePage(ids,n+1,chunks.length),wrap=document.createElement('div'),zoom=document.createElement('div');wrap.className='page-wrap';wrap.style.width=p.width*scale+'px';wrap.style.height=p.height*scale+25+'px';zoom.className='page-scale';zoom.style.transform=`scale(${scale})`;zoom.append(page);wrap.append(zoom);const caption=document.createElement('div');caption.className='page-counter';caption.style.cssText=`position:absolute;top:${p.height*scale}px;width:100%`;caption.textContent=`${fa(n+1)} / ${fa(chunks.length)}`;wrap.append(caption);host.append(wrap);if(!fitText(page))state.layoutError=true;});
 $('summary').textContent=`${fa(state.data.groups.length)} گزینه • ${fa(chunks.length)} صفحه • منبع: ${state.data.sheetName}`;window.PackageEditor?.sync();updateWarnings();
}
function selectTemplate(value){$('template').value=value;const alignScope=document.getElementById('packageAlignAll');if(alignScope)alignScope.checked=false;if(state.data)window.PackageCards?.includeSource(state.data.cards);else $('title').value=profile().title;$('fontSize').value=profile().font;$('tableColor').value=profile().color;drawCards();render();}
function applyData(d){state.data=d;state.cards=window.PackageCards?.dataForImport(d.cards)||structuredClone(d.cards);state.reference=false;$('reference').textContent='نمایش مرجع';if(d.template&&!state.templatePinned)syncTemplateCountry(d.template);window.PackageCards?.includeSource(d.cards);$('title').value=d.title||profile().title;$('date').value=d.date;$('duration').value=d.duration;$('stays').value=d.stays||'';$('infantValue').value=d.cards.infant?.value??'';$('infantUnit').value=d.cards.infant?.unit??'';$('notes').value=d.notes;$('adjustments').value=d.adjustments||'';$('services').value=d.services||'';$('unit').value=d.template?.startsWith('malaysia-')||d.template?.startsWith('thailand-')?'$':d.template?.startsWith('spain-')?'€':'';$('fontSize').value=profile().font;$('tableColor').value=profile().color;drawCards();render();message(`${fa(d.groups.length)} گزینه و ${fa(Object.values(d.cards).filter(c=>!unavailable(c.value)).length)} کادرِ پایین صفحه از «${d.sheetName}» وارد شد؛ متن‌ها و نرخ‌ها قابل ویرایش‌اند.`);}
async function importFile(file){
 if(!file||state.busy)return;if(!/\.(xlsx|docx)$/i.test(file.name)){message('فایل XLSX یا DOCX انتخاب کن.',true);return;}state.lastError='';const id=++state.importId;window.PackageCards?.rememberCustom();state.data=null;state.reference=false;state.cards={};updateWarnings();message('در حال خواندن فایل…');
 try{const bytes=new Uint8Array(await file.arrayBuffer());if(id!==state.importId)return;state.bytes=bytes;state.fileName=file.name;
  if(/\.docx$/i.test(file.name)){$('sheet').replaceChildren(new Option('فایل Word','word'));$('sheet').value='word';$('sheet').disabled=true;$('fileinfo').textContent=file.name;applyData(WordPackage.parse(bytes,{fileName:file.name}));}
  else{const names=PKJ.list(bytes);$('sheet').replaceChildren(...names.map(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;return o;}));$('sheet').disabled=false;const chosen=PKJ.choose(names);if(!chosen)throw Error('شیت خروجی را از فهرست انتخاب کن.');$('sheet').value=chosen;$('fileinfo').textContent=file.name;applyData(PKJ.parse(bytes,{sheetName:chosen,fileName:file.name}));}
 }catch(e){message(e.message||'فایل قابل خواندن نیست.',true);render();}
}
function commitEdit(el){
 if(el.dataset.group===undefined||!state.data)return;const g=state.data.groups[Number(el.dataset.group)],t=el.innerText.replace(/[\r\n]/g,' ').trim().slice(0,220);
 if(el.dataset.price){const c=g.prices[el.dataset.price],currency=t.match(/€|\$|تومان|ریال|یورو|دلار/)?.[0]||'',spain=profile().style.startsWith('spain-');if(spain)c.suffix=/نرخ\s*پرواز/.test(t)?'+ نرخ پرواز':'';const clean=latin(spain?t.replace(/\+?\s*نرخ\s*پرواز/g,''):t).replace(/€|\$|تومان|ریال|یورو|دلار/g,'').replace(/[,٬]/g,'').replace(/٫/g,'.').trim();c.value=/^-?\d+(\.\d+)?$/.test(clean)?Number(clean):clean;c.currency=currency.replace('یورو','€').replace('دلار','$');if(c.decimals===0&&/\.\d/.test(clean))c.decimals=2;}
 else{const h=g.hotels[Number(el.dataset.hotel)];h[el.dataset.key]=t;if(el.dataset.key==='service'&&profile().style!=='spain-combined')h.stars='';}
}
$('pages').addEventListener('focusout',e=>{if(e.target.matches('[contenteditable]')){if(e.target.dataset.section&&window.PackageEditor?.commitInline(e.target))return;commitEdit(e.target);render();}});$('pages').addEventListener('keydown',e=>{if(e.target.matches('[contenteditable]')&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.target.blur();}});$('pages').addEventListener('paste',e=>{if(e.target.matches('[contenteditable]')){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}});
$('cards').addEventListener('input',e=>{
 const titleKey=e.target.dataset.cardTitle;if(titleKey){window.PackageEditor?.setCardText('label_'+titleKey,e.target.value);}
 else{const key=e.target.dataset.card||e.target.dataset.cardUnit;if(!key)return;const field=e.target.dataset.card?'value':'unit';state.cards[key]||={value:'',unit:'تومان'};state.cards[key][field]=e.target.value;window.PackageEditor?.setCardText(field+'_'+key,e.target.value);}
 state.reference=false;$('reference').textContent='نمایش مرجع';render();
});
$('excel').addEventListener('change',e=>importFile(e.target.files[0]));$('sheet').addEventListener('change',()=>{if(/\.docx$/i.test(state.fileName))return;try{applyData(PKJ.parse(state.bytes,{sheetName:$('sheet').value,fileName:state.fileName}));}catch(e){state.data=null;message(e.message,true);render();}});$('templateCountry').addEventListener('change',()=>{state.templatePinned=true;selectTemplate(syncTemplateOptions($('templateCountry').value));});$('template').addEventListener('change',()=>{state.templatePinned=true;selectTemplate($('template').value);});
for(const t of ['dragover','dragenter'])$('dropzone').addEventListener(t,e=>{e.preventDefault();$('dropzone').classList.add('drag');});for(const t of ['dragleave','drop'])$('dropzone').addEventListener(t,e=>{e.preventDefault();$('dropzone').classList.remove('drag');if(t==='drop')importFile(e.dataTransfer.files[0]);});
for(const key of ['title','date','duration','stays','infantLabel','infantValue','infantUnit','unit','perPage','notes','adjustments','services','fontSize','tableColor'])$(key).addEventListener('input',render);$('showLayers').addEventListener('change',render);$('resetStyle').addEventListener('click',()=>selectTemplate($('template').value));$('reference').addEventListener('click',()=>{state.reference=!state.reference;$('reference').textContent=state.reference?'بازگشت به پکیج':'نمایش مرجع';render();});let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportPackage(type){
 document.activeElement?.blur();state.reference=false;$('reference').textContent='نمایش مرجع';render();if($(type).disabled)return;state.busy=true;updateWarnings();
 const controls=[...document.querySelectorAll('.controls input,.controls textarea,.controls select,.controls button,#reference,#downloadUnit,#downloadFixLayout')],disabledBefore=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
 const p=profile(),pages=[...document.querySelectorAll('.package-page')],name=($('title').value+' '+$('date').value).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().slice(0,100)||'package',pdf=type==='pdf'?new jspdf.jsPDF({unit:'pt',format:[p.width*.75,p.height*.75],orientation:'portrait',compress:true}):null,images=[];
 const stage=document.createElement('div');stage.style.cssText='position:absolute;left:0;top:0;z-index:-5;direction:ltr';document.body.append(stage);
 try{await window.PackageEditor?.ready();await document.fonts.ready;for(let i=0;i<pages.length;i++){message(`ساخت ${type.toUpperCase()}؛ صفحهٔ ${fa(i+1)} از ${fa(pages.length)}…`);const page=pages[i].cloneNode(true);page.classList.add('exporting');page.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));stage.replaceChildren(page);await Promise.all([...page.querySelectorAll('img')].map(img=>img.decode()));
  const canvas=await html2canvas(page,{scale:2,backgroundColor:'#fff',logging:false,windowWidth:Math.max(1440,p.width),width:p.width,height:p.height,scrollX:0,scrollY:0});
  if(type==='pdf'){if(i)pdf.addPage([p.width*.75,p.height*.75]);pdf.addImage(canvas.toDataURL('image/jpeg',.98),'JPEG',0,0,p.width*.75,p.height*.75);}else{const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('ساخت تصویر ناموفق بود.');images.push(new Uint8Array(await blob.arrayBuffer()));}canvas.width=0;canvas.height=0;
 }
 if(pdf)pdf.save(name+'.pdf');else if(images.length===1)download(new Blob(images,{type:'image/png'}),name+'.png');else download(new Blob([fflate.zipSync(Object.fromEntries(images.map((b,i)=>[name+'-'+(i+1)+'.png',b])),{level:0})],{type:'application/zip'}),name+'-PNG.zip');message('خروجی آماده شد؛ فایل در پوشهٔ دانلود مرورگر قرار می‌گیرد.');
 }catch(e){message('خروجی ساخته نشد: '+e.message,true);}finally{stage.remove();state.busy=false;controls.forEach((c,i)=>c.disabled=disabledBefore[i]);updateWarnings();}
}
$('downloadUnit').addEventListener('change',()=>{if(state.busy)return;$('unit').value=$('downloadUnit').value;render();});$('downloadFixLayout').addEventListener('click',showLayoutIssue);
$('png').addEventListener('click',()=>exportPackage('png'));$('pdf').addEventListener('click',()=>exportPackage('pdf'));syncTemplateOptions($('templateCountry').value,$('template').value);drawCards();render();
