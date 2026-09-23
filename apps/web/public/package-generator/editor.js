'use strict';
// Edits sit above the original artwork. Unchanged artwork keeps its original pixels.
window.PackageEditor=(()=>{
 const designs={},logos={},customFonts=[],jobs=new Set(),paper=new Map();let selected='title',lastTemplate='',nextText=1,nextFont=1;
 const address='آدرس: تهران، جردن، تقاطع میرداماد، کنار گذر مدرس، پلاک ۳۸۶، طبقه سوم';
 const geometry={
  combined:{subtitle:[482,151,427,34],phone:[125,1337,219,44],address:[440,1340,643,45],serviceLabel:[933,1249,82,36],duration:[588,207,134,34],labelOffset:32},
  kus:{subtitle:[695,207,373,36],phone:[137,1274,220,49],address:[456,1280,638,45],serviceLabel:[1014,1198,84,34],duration:[500,204,183,31],labelOffset:31},
  antalya:{subtitle:[491,178,422,37],phone:[124,1340,220,45],address:[443,1340,651,45],serviceLabel:[999,1281,86,30],duration:[451,163,429,16],labelOffset:30},
  bodrum:{subtitle:[620,220,361,39],phone:[132,1461,196,47],address:[425,1460,566,51],serviceLabel:[884,1378,94,30],duration:[480,224,105,33],labelOffset:34},
  nss:{subtitle:[616,222,383,37],phone:[129,1424,196,49],address:[427,1423,590,48],serviceLabel:[925,1285,73,35],duration:[488,178,344,29],labelOffset:31},
  'malaysia-kuala':{subtitle:[662,240,328,35],phone:[108,1445,203,52],address:[420,1445,584,52],serviceLabel:[851,1326,71,27],duration:[487,129,326,54],labelOffset:30},
  'malaysia-penang':{subtitle:[662,244,328,35],phone:[108,1445,203,52],address:[420,1445,584,52],serviceLabel:[849,1274,74,30],duration:[433,129,370,52],labelOffset:30},
  'malaysia-singapore':{subtitle:[758,231,333,34],phone:[112,1300,245,61],address:[445,1300,648,61],serviceLabel:[923,1155,77,32],duration:[489,116,346,55],labelOffset:30},
  'malaysia-langkawi':{subtitle:[662,248,328,30],phone:[110,1417,203,52],address:[410,1417,584,52],serviceLabel:[847,1265,75,30],duration:[453,142,283,39],labelOffset:30},
  'spain-barcelona':{subtitle:[558,402,375,42],phone:[199,1561,210,52],address:[486,1560,440,55],serviceLabel:[800,1246,123,37],duration:[406,271,319,67],labelOffset:30},
  'spain-madrid':{subtitle:[583,391,345,41],phone:[207,1562,204,52],address:[485,1562,440,55],serviceLabel:[808,1240,120,38],duration:[412,258,319,65],labelOffset:30},
  'spain-combined':{subtitle:[558,441,369,42],phone:[202,1562,206,52],address:[487,1562,439,55],serviceLabel:[806,1232,120,40],duration:[408,289,267,78],labelOffset:30}
 };
 function model(){return designs[$('template').value]||=( {texts:{},styles:{},extras:[],align:''} );}
 function hasText(key){return Object.hasOwn(model().texts,key);}
 function needs(key){return (window.PackageCards?.active&&/^(label|value|unit)_/.test(key))||hasText(key)||!!model().styles[key]||!!$('globalFont').value||!!model().align;}
 function text(key,fallback){return hasText(key)?model().texts[key]:fallback;}
 function coreText(key){
  if(['title','date','duration','stays','infantLabel','infantValue','infantUnit','adjustments'].includes(key))return $(key).value;
  if(key==='services')return $('services').value||(hasText(key)?'':defaultServices());
  if(key.startsWith('value_'))return state.cards[key.slice(6)]?.value??'';
  if(key.startsWith('unit_'))return state.cards[key.slice(5)]?.unit??'تومان';
  return '';
 }
 function definitions(){
  const p=profile(),geo=geometry[p.style],m=model(),cols=state.data?columns():p.columns.map((width,i)=>({key:(p.style==='combined'?['hotel','city','service','double','single','child','small']:p.style==='antalya'?['hotel','room','service','double','single','child']:p.style.startsWith('malaysia-')?['hotel','service','double','single','extra','child','small']:p.style==='spain-combined'?['hotel','stars','service','double','single','child','small']:p.style.startsWith('spain-')?['hotel','service','double','single','child','small']:['hotel','service','double','single','child'])[i],width}));
  const titles={city:'شهر',hotel:'نام هتل',stars:'ستاره',room:'نوع اتاق',service:'خدمات',double:'دوتخته',single:'یک تخت',extra:'اضافه',child:'کودک با تخت',small:p.style.startsWith('malaysia-')?'کودک بدون تخت':'کودک ۲–۶ سال'};
  const list=[
   {id:'title',label:'عنوان شهر',box:p.titleBox,kind:'core',size:({combined:66,kus:108,antalya:120,bodrum:92,nss:120})[p.style]||86},
   {id:'date',label:'تاریخ حرکت',box:p.date,kind:'core',size:26,color:'#ffffff'},
   {id:'duration',label:'مدت سفر',box:geo.duration,kind:'core',size:p.style==='antalya'?12:16},
   {id:'subtitle',label:'نام انگلیسی آژانس',box:geo.subtitle,kind:'static',value:p.style==='nss'?'Niayesh Seir tour & travel Agency':'Jahan Bastan tour & travel Agency',size:23,color:'#8b8b8b',direction:'ltr'},
   {id:'table',label:'همهٔ متن‌های جدول',kind:'column',size:Number($('fontSize').value),color:$('tableColor').value},
   ...cols.map(c=>({id:'column_'+c.key,label:'متن ستون '+titles[c.key],kind:'column',size:c.key==='room'?12:Number($('fontSize').value),color:$('tableColor').value})),
   ...cols.map(c=>({id:'header_'+c.key,label:'تیتر ستون '+titles[c.key],kind:'header',value:c.label||titles[c.key],size:16,color:'#ffffff'}))
  ];
  if(p.adjustmentsBox)list.push({id:'adjustments',label:'تاریخ‌ها و افزایش نرخ',box:p.adjustmentsBox,kind:'core',size:15});
  if(p.style==='combined')list.push({id:'infant',label:'چینش کل نوار نوزاد',kind:'group',box:p.infantBox,size:24},{id:'stays',label:'تقسیم اقامت بین شهرها',kind:'core',box:p.staysBox,size:19},{id:'infantLabel',label:'عنوان نوار نوزاد',kind:'core',box:p.infantBox,size:24},{id:'infantValue',label:'مبلغ نوزاد',kind:'core',box:p.infantBox,size:28},{id:'infantUnit',label:'ارز نوزاد',kind:'core',box:p.infantBox,size:20});
  for(const slot of p.cardSlots){const cardTitle=window.PackageCards?.title(slot)??slot.label;list.push(
   {id:'label_'+slot.key,label:'عنوان کادر: '+(cardTitle||'بدون عنوان'),kind:'static',value:slot.label+'\u00a0:',box:slot.labelBox||[slot.box[0]-2,slot.box[1]-geo.labelOffset,slot.box[2]+4,geo.labelOffset-1],size:slot.labelBox?16:(p.style==='bodrum'?15:18)},
   {id:'value_'+slot.key,label:'مبلغ کادر: '+(cardTitle||'بدون عنوان'),kind:'core',box:slot.box,size:p.style==='bodrum'?19:p.style==='nss'?18:26,direction:'ltr'},
   {id:'unit_'+slot.key,label:'واحد کادر: '+(cardTitle||'بدون عنوان'),kind:'core',box:slot.box,size:16}
  );}
  list.push(
   {id:'serviceLabel',label:'عنوان بخش خدمات',kind:'static',value:'خدمات:',box:geo.serviceLabel,size:21},
   {id:'services',label:'متن خدمات',kind:'core',box:p.servicesBox,size:21},
   {id:'phone',label:'تلفن فوتر',kind:'static',value:'021-72075000',box:geo.phone,size:31,color:'#ffffff',direction:'ltr',background:'footer'},
   {id:'address',label:'آدرس فوتر',kind:'static',value:address,box:geo.address,size:21,color:'#ffffff',background:'footer'},
   ...m.extras.map(e=>({id:e.id,label:'متن دلخواه '+e.number,kind:'extra',box:e.box,value:e.text,size:24,...e}))
  );return list;
 }
 function def(key=selected){return definitions().find(d=>d.id===key);}
 function customHeader(){return definitions().some(d=>d.kind==='header'&&needs(d.id));}
 function holes(){
  const p=profile(),list=[];
  for(const d of definitions()){
   if(d.kind==='static'&&needs(d.id))list.push(d.box);
   if(d.kind==='core'&&needs(d.id)&&(!state.data||d.id==='services'||d.id==='duration'))list.push(d.box);
  }
  if(!state.data&&customHeader())list.push(headerBox());
  for(const key of ['agency','airline'])if(logos[key])list.push(LAYER_GEOMETRY[p.style][key]);
  return list;
 }
 function overlay(d,value,bg){
   const box=place('editor-text editor-'+d.id+(d.kind==='extra'?' extra-text':''),d.box,`<span>${esc(value)}</span>`);
   return box.replace('style="',`data-section="${esc(d.id)}" style="${bg?'background:'+bg+';':''}`);
 }
 function hitTargets(){
  const p=profile(),defs=definitions();let html='';
  for(const d of defs){
   if(!d.box||needs(d.id)||!['static','core'].includes(d.kind))continue;
   html+=place('editor-hit',d.box,'').replace('style="',`data-editor-hit="${esc(d.id)}" aria-label="ویرایش ${esc(d.label)}" title="برای ویرایش کلیک کن" style="`);
  }
  if(!customHeader()){
   const head=defs.filter(d=>d.kind==='header'),widths=state.data?columns().map(c=>c.width):p.columns;
   html+=place('editor-hit-header',headerBox(),head.map((d,i)=>`<span data-editor-hit="${esc(d.id)}" aria-label="ویرایش ${esc(d.label)}" title="برای ویرایش کلیک کن" style="width:${widths[i]||100/head.length}%"></span>`).join(''));
  }
  return html;
 }
 function overlays(){
  const p=profile();let html='';
  for(const d of definitions())if(d.kind==='static'&&needs(d.id)||d.kind==='extra'){
   let bg=d.kind==='extra'?'transparent':'#fff';
   if(d.background==='footer')bg=paper.get(p.style+'_'+d.id)?`url('${paper.get(p.style+'_'+d.id)}') 0 0 / 100% 100%`:'#03245c';
   html+=overlay(d,text(d.id,d.value),bg);
  }
  if(!p.durationBox&&($('duration').value||needs('duration')))html+=overlay(def('duration'),prettyFa($('duration').value),'#fff');
  // Explicitly clearing services must also erase the old bitmap text.
  if(needs('services')&&!servicesText())html+=overlay(def('services'),'','#fff');
  if(!state.data&&customHeader()){
   const head=definitions().filter(d=>d.kind==='header');
   html+=place('custom-header',headerBox(),head.map((d,i)=>`<span data-section="${d.id}" style="width:${p.columns[i]}%">${esc(text(d.id,d.value))}</span>`).join(''));
  }
  for(const key of ['agency','airline'])if(logos[key]){
   const logo=logos[key],box=LAYER_GEOMETRY[p.style][key],scale=Math.min(box[2]/logo.width,box[3]/logo.height)*Number($(key+'Scale').value)/100;
   html+=place('uploaded-logo',box,`<img data-uploaded-logo="${key}" src="${logo.src}" alt="لوگوی ${key==='agency'?'آژانس':'ایرلاین'}" style="width:${logo.width*scale}px;height:${logo.height*scale}px">`);
  }
  return html+hitTargets();
 }
 function nodes(page,d){
   const map={title:'.title-slot',date:'.date-slot',duration:'.duration-slot',services:'.services-slot,[data-section="services"]',adjustments:'.adjustments-slot',stays:'.stays-slot',infant:'.infant-slot',infantLabel:'.infant-slot span',infantValue:'.infant-slot b',infantUnit:'.infant-slot small'};
  let selector=map[d.id]||`[data-section="${d.id}"]`;
  if(d.id==='title')selector='.title-slot';if(d.id==='date')selector='.date-slot';
  if(d.id==='duration')selector='.duration-slot,[data-section="duration"]';
  if(d.id==='table')selector='.data-table .editable';
  if(d.id.startsWith('column_')){const k=d.id.slice(7);selector=state.data?.priceKeys.includes(k)?`[data-price="${k}"]`:`td.${k} .editable`;}
  if(d.id.startsWith('value_'))selector='.value-'+d.id.slice(6)+' b';
  if(d.id.startsWith('unit_'))selector='.value-'+d.id.slice(5)+' small';
  return page.querySelectorAll(selector);
 }
 function decorate(page){
  const m=model(),all=$('globalFont').value;
  for(const d of definitions()){
   const style=d.id.startsWith('column_')?{...m.styles.table,...m.styles[d.id]}:(m.styles[d.id]||{}),isColumn=d.kind==='column',base=isColumn?{}:{size:d.size,color:d.color||'#071c50',weight:'700'},merged={...base,...style};
   for(const el of nodes(page,d)){
     if(d.kind!=='core'&&d.kind!=='column'){el.dataset.section=d.id;el.dir=d.direction||'rtl';}
     if(d.kind==='core')el.dataset.section=d.id;
     if(['static','core','header'].includes(d.kind)){el.contentEditable='true';el.setAttribute('role','textbox');el.tabIndex=0;el.spellcheck=false;el.title='برای ویرایش کلیک کن';}
    if(!needs(d.id)&&d.kind!=='extra'&&!(d.id.startsWith('column_')&&m.styles.table))continue;
    const font=style.font||all;if(font)el.style.setProperty('font-family',`"${font}",Tahoma,Arial,sans-serif`,'important');
    if(merged.size){el.style.setProperty('font-size',merged.size+'px','important');if(isColumn)el.dataset.editorSize=merged.size;}
    if(merged.color)el.style.setProperty('color',merged.color,'important');
    if(merged.weight)el.style.fontWeight=merged.weight;
    const align=style.align||(/^infant(?:Label|Value|Unit)$/.test(d.id)?'':m.align);if(align)TextAlignment.apply(el,align);
   }
  }
 }
 const fontNames=['Tahoma','Arial','Times New Roman','Segoe UI'];
 function installed(name){const c=document.createElement('canvas').getContext('2d'),sample='آژانس گردشگری ABC0123';c.font='40px monospace';const a=c.measureText(sample).width;c.font=`40px "${name}", monospace`;return Math.abs(c.measureText(sample).width-a)>.1;}
 for(const name of ['Titr','B Titr','B Nazanin','B Mitra','B Yekan','Vazirmatn','IRANSans','IranNastaliq'])if(installed(name))fontNames.push(name);
 function fontOptions(){for(const id of ['globalFont','sectionFont']){
  const host=$(id),v=host.value;host.replaceChildren();host.add(new Option(id==='globalFont'?'فونت اصلی قالب':'پیروی از فونت کل طرح',''));
  for(const name of fontNames)host.add(new Option(name,name));for(const f of customFonts)host.add(new Option(f.name+' · فایل واردشده',f.family));host.value=v;
 }}
 function panel(){
  const d=def();if(!d)return;const m=model(),style=m.styles[selected]||{};
  $('sectionText').disabled=['column','group'].includes(d.kind);$('sectionText').value=['column','group'].includes(d.kind)?'':d.kind==='core'?coreText(d.id):text(d.id,d.value);
  $('sectionHint').textContent=d.kind==='group'?'چینش این گزینه روی تمام نوار نوزاد اعمال می‌شود؛ عنوان، مبلغ و ارز از بخش اطلاعات پکیج قابل ویرایش‌اند.':d.kind==='column'?'متن هر هتل یا قیمت را با کلیک روی همان خانهٔ جدول تغییر بده. تنظیمات زیر روی فونت این بخش اعمال می‌شوند.':'متن جدید جای متن قبلی می‌نشیند؛ خالی کردن این ورودی، متن این بخش را حذف می‌کند.';
  $('sectionFont').value=style.font||'';$('sectionSize').value=style.size||d.size;$('sectionColor').value=style.color||d.color||'#071c50';$('sectionWeight').value=style.weight||'700';$('sectionAlign').value=document.getElementById('packageAlignAll')?.checked?m.align||'':style.align||'';$('globalAlign').value=m.align||'';
  $('extraPosition').hidden=d.kind!=='extra';
  if(d.kind==='extra'){const p=profile();for(const [id,n,dim] of [['extraX',0,p.width],['extraY',1,p.height],['extraWidth',2,p.width],['extraHeight',3,p.height]])$(id).value=d.box[n]/dim*100;}
 }
 function sync(){
  window.PackageCards?.syncTitles();
  $('globalAlign').value=model().align||'';
  const defs=definitions(),sig=$('template').value+defs.map(d=>d.id+':'+d.label).join('|');
  if(lastTemplate!==sig){lastTemplate=sig;const host=$('textSection');host.replaceChildren(...defs.map(d=>new Option(d.label,d.id)));if(!defs.some(d=>d.id===selected))selected='title';host.value=selected;if(document.activeElement?.id!=='sectionText')panel();}
  if(!document.activeElement?.closest('.controls')||!['sectionText','sectionSize','sectionFont','sectionColor','sectionWeight','sectionAlign'].includes(document.activeElement.id))panel();
 }
 function refresh(){state.reference=false;$('reference').textContent='نمایش مرجع';render();}
 function updateText(value){
  const d=def();if(!d||['column','group'].includes(d.kind))return;model().texts[d.id]=value;
   if(d.kind==='core'){
    if(['title','date','duration','stays','infantLabel','infantValue','infantUnit','services','adjustments'].includes(d.id))$(d.id).value=value;
    if(d.id==='services'&&$('notes').value)$('notes').value='';
   if(d.id.startsWith('value_')||d.id.startsWith('unit_')){const unit=d.id.startsWith('unit_'),key=d.id.slice(unit?5:6);state.cards[key]||={value:'',unit:'تومان'};state.cards[key][unit?'unit':'value']=value;drawCards();}
  }
  if(d.kind==='extra')model().extras.find(e=>e.id===d.id).text=value;
  refresh();
 }
 function inlineValue(el,d){
  let value=el.innerText.replace(/\r/g,'').trim();
  if(!['services','adjustments','address'].includes(d.id))value=value.replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  return value.slice(0,1200);
 }
 function selectInline(key){selected=key;$('textSection').value=selected;panel();}
 function focusInline(key,pageIndex=0){
  const page=$('pages').querySelectorAll('.package-page')[pageIndex]||$('pages').querySelector('.package-page'),d=def(key);if(!page||!d)return;
  const target=[...nodes(page,d)].find(el=>el.dataset.section===key)||page.querySelector(`[data-section="${CSS.escape(key)}"]`);if(!target)return;
  target.focus({preventScroll:true});const range=document.createRange();range.selectNodeContents(target);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 }
 function activateInline(key,pageIndex){
  const d=def(key);if(!d||!['static','core','header'].includes(d.kind))return;
  selectInline(key);if(!hasText(key)){const initial=d.kind==='core'?coreText(key):d.value??'';model().texts[key]=initial;if(d.kind==='core'&&$(key))$(key).value=initial;}
  refresh();requestAnimationFrame(()=>focusInline(key,pageIndex));
 }
 function stageInline(el){
  const key=el?.dataset?.section,d=key&&def(key);if(!d||!['static','core','header'].includes(d.kind))return false;
  const value=inlineValue(el,d);model().texts[key]=value;
  if(d.kind==='core'){
   if(['title','date','duration','stays','infantLabel','infantValue','infantUnit','services','adjustments'].includes(key))$(key).value=value;
   if(key==='services'&&$('notes').value)$('notes').value='';
   if(key.startsWith('value_')||key.startsWith('unit_')){const unit=key.startsWith('unit_'),cardKey=key.slice(unit?5:6);state.cards[cardKey]||={value:'',unit:'تومان'};state.cards[cardKey][unit?'unit':'value']=value;}
  }
  if(document.activeElement?.id!=='sectionText')$('sectionText').value=value;return true;
 }
 function commitInline(el){
  const key=el?.dataset?.section;if(!key||!stageInline(el))return false;selectInline(key);drawCards();refresh();return true;
 }
 function reset(){const d=def(),m=model();delete m.styles[selected];delete m.texts[selected];
  if(d.kind==='core'){
   if(['title','date','duration','stays','infantLabel','infantValue','infantUnit','adjustments'].includes(d.id))$(d.id).value=state.data?.[d.id]||(d.id==='title'?profile().title:'');
   if(d.id==='infantLabel')$('infantLabel').value='نرخ نوزاد';if(d.id==='infantValue')$('infantValue').value=state.data?.cards.infant?.value??'';if(d.id==='infantUnit')$('infantUnit').value=state.data?.cards.infant?.unit??'';
   if(d.id==='services')$('services').value='';
   if(d.id.startsWith('value_')||d.id.startsWith('unit_')){const unit=d.id.startsWith('unit_'),key=d.id.slice(unit?5:6);state.cards[key]=structuredClone(state.data?.cards[key]||{value:'',unit:'تومان'});drawCards();}
  }
  refresh();panel();
 }
 function track(promise){jobs.add(promise);updateWarnings();promise.finally(()=>{jobs.delete(promise);updateWarnings();}).catch(()=>{});return promise;}
 async function ready(){await Promise.all([...jobs]);}
 async function loadLogo(key,file){if(!file)return;
  try{
   if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('لوگو را با فرمت PNG، JPG یا WebP انتخاب کن.');
   if(file.size>15*1024*1024)throw Error('حجم لوگو باید کمتر از ۱۵ مگابایت باشد.');
   const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('فایل تصویر خوانده نشد.'));r.readAsDataURL(file);});
   const img=new Image();img.src=src;await img.decode();if(!img.naturalWidth||img.naturalWidth>16000||img.naturalHeight>16000)throw Error('ابعاد تصویر مناسب نیست.');
   // Normalize for predictable, offline canvas/PDF export, including transparent logos.
   const factor=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   logos[key]={src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};$('assetStatus').textContent='لوگوی '+(key==='agency'?'آژانس':'ایرلاین')+' جایگزین شد.';refresh();
  }catch(e){$('assetStatus').textContent=e.message||'تصویر قابل خواندن نیست.';}
 }
 async function loadFont(file){if(!file)return;try{
  if(!/\.(ttf|otf|woff2?)$/i.test(file.name)||file.size>20*1024*1024)throw Error('فایل فونت TTF، OTF، WOFF یا WOFF2 تا ۲۰ مگابایت انتخاب کن.');
  const family='PackageFont'+nextFont++,face=new FontFace(family,await file.arrayBuffer());await face.load();
  const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('فایل فونت خوانده نشد.'));reader.readAsDataURL(file);});
  // The export document is a clone: carry font data in a stylesheet as well.
  const css=document.createElement('style');css.dataset.uploadedFont=family;css.textContent=`@font-face{font-family:"${family}";src:url("${src}");font-style:normal;font-weight:100 900;font-display:block}`;document.head.append(css);await document.fonts.load(`20px "${family}"`);
  customFonts.push({name:file.name.replace(/\.[^.]+$/,''),family});fontOptions();
  const d=def();model().styles[d.id]||={};model().styles[d.id].font=family;$('sectionFont').value=family;$('assetStatus').textContent='فونت به فهرست اضافه و برای بخش انتخاب‌شده فعال شد.';refresh();panel();
 }catch(e){$('assetStatus').textContent='فونت بارگذاری نشد: '+e.message;}}
 async function preparePaper(){
  await Promise.all(Object.values(TEMPLATES).map(async p=>{
   const image=new Image();image.src=p.image;await image.decode();
   for(const key of ['phone','address']){const [x,,w,h]=geometry[p.style][key],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,x,LAYER_GEOMETRY[p.style].footer[1]+4,w,1,0,0,w,h);paper.set(p.style+'_'+key,canvas.toDataURL('image/png'));}
  }));refresh();
 }
 fontOptions();$('textSection').addEventListener('change',()=>{selected=$('textSection').value;if(document.getElementById('packageAlignAll'))document.getElementById('packageAlignAll').checked=false;panel();});
 $('globalAlign').addEventListener('input',()=>{model().align=$('globalAlign').value;refresh();});
 $('sectionText').addEventListener('input',e=>updateText(e.target.value));$('globalFont').addEventListener('change',refresh);
 for(const [id,key] of [['sectionFont','font'],['sectionSize','size'],['sectionColor','color'],['sectionWeight','weight'],['sectionAlign','align']])$(id).addEventListener('input',()=>{
  if(key==='align'&&document.getElementById('packageAlignAll')?.checked){model().align=$(id).value;$('globalAlign').value=model().align;refresh();return;}
  model().styles[selected]||={};let value=$(id).value;if(key==='size'){value=Number(value);if(value<8||value>140)return;}model().styles[selected][key]=value;refresh();
 });
 $('resetSection').addEventListener('click',reset);
 $('fontUpload').addEventListener('change',e=>track(loadFont(e.target.files[0])));
 for(const key of ['agency','airline']){
  $(key+'Upload').addEventListener('change',e=>track(loadLogo(key,e.target.files[0])));
  $(key+'Scale').addEventListener('input',refresh);
  $(key+'Reset').addEventListener('click',()=>{delete logos[key];$(key+'Upload').value='';$(key+'Scale').value='100';$('assetStatus').textContent='لوگوی اصلی بازگردانده شد.';refresh();});
 }
 $('addText').addEventListener('click',()=>{const p=profile(),number=nextText++;selected='extra_'+number;model().extras.push({id:selected,number,text:'متن دلخواه',box:[p.width*.4,p.height*.12,p.width*.35,p.height*.04]});refresh();$('textSection').value=selected;panel();$('sectionText').focus({preventScroll:true});$('sectionText').select();});
 $('deleteText').addEventListener('click',()=>{const m=model();m.extras=m.extras.filter(e=>e.id!==selected);delete m.texts[selected];delete m.styles[selected];selected='title';refresh();});
 function constrain(e){const p=profile();e.box[2]=Math.min(e.box[2],p.width);e.box[3]=Math.min(e.box[3],p.height);e.box[0]=Math.max(0,Math.min(e.box[0],p.width-e.box[2]));e.box[1]=Math.max(0,Math.min(e.box[1],p.height-e.box[3]));}
 for(const [id,n,dim] of [['extraX',0,'width'],['extraY',1,'height'],['extraWidth',2,'width'],['extraHeight',3,'height']])$(id).addEventListener('input',()=>{const e=model().extras.find(e=>e.id===selected);if(!e)return;e.box[n]=Number($(id).value)*profile()[dim]/100;constrain(e);refresh();});
 let dragging=null;
 $('pages').addEventListener('pointerdown',event=>{
  const el=event.target.closest('.extra-text');if(!el||state.busy)return;const data=model().extras.find(e=>e.id===el.dataset.section);if(!data)return;
  selected=data.id;$('textSection').value=selected;panel();const page=el.closest('.package-page');dragging={id:event.pointerId,x:event.clientX,y:event.clientY,box:[...data.box],el,data,scale:page.getBoundingClientRect().width/profile().width};el.setPointerCapture(event.pointerId);event.preventDefault();
 });
 $('pages').addEventListener('pointermove',event=>{if(!dragging||event.pointerId!==dragging.id)return;const d=dragging;d.data.box[0]=d.box[0]+(event.clientX-d.x)/d.scale;d.data.box[1]=d.box[1]+(event.clientY-d.y)/d.scale;constrain(d.data);d.el.style.left=d.data.box[0]+'px';d.el.style.top=d.data.box[1]+'px';});
 for(const ev of ['pointerup','pointercancel'])$('pages').addEventListener(ev,()=>{if(dragging){dragging=null;refresh();panel();}});
 $('pages').addEventListener('click',e=>{const hit=e.target.closest('[data-editor-hit]');if(!hit||state.busy)return;const page=hit.closest('.package-page'),pageIndex=[...$('pages').querySelectorAll('.package-page')].indexOf(page);e.preventDefault();activateInline(hit.dataset.editorHit,Math.max(0,pageIndex));});
 $('pages').addEventListener('focusin',e=>{const el=e.target.closest('[data-section][contenteditable="true"]');if(el&&def(el.dataset.section))selectInline(el.dataset.section);});
 $('pages').addEventListener('input',e=>{const el=e.target.closest('[data-section][contenteditable="true"]');if(el)stageInline(el);});
 $('pages').addEventListener('focusout',e=>{const el=e.target.closest('[data-section][contenteditable="true"]');if(!el||!def(el.dataset.section))return;e.stopImmediatePropagation();commitInline(el);},true);
 // Custom free-position text keeps drag behavior and opens in the side field on double-click.
 $('pages').addEventListener('dblclick',e=>{const el=e.target.closest('.extra-text');if(!el||!def(el.dataset.section))return;selected=el.dataset.section;$('textSection').value=selected;panel();$('sectionText').focus({preventScroll:true});});
 setTimeout(()=>{sync();track(preparePaper()).catch(()=>{});},0);
 return {alignmentDefinitions:definitions,getAlignment:key=>model().styles[key]?.align||'',setAlignment:(keys,value)=>{
  if(state.busy||!['','left','center','right'].includes(value))return;
  for(const key of Array.isArray(keys)?keys:[keys])if(def(key)){model().styles[key]||={};model().styles[key].align=value;}
  refresh();
 },setCardText:(key,value)=>{model().texts[key]=value;},commitInline,needs,hasText,text,holes,overlays,decorate,customHeader,sync,ready,get pending(){return jobs.size>0;}};
})();
