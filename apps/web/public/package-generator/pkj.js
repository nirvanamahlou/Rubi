/* Local XLSX import. Only the selected output worksheet is decompressed.
   Formula text is never executed; cached values and Excel number formats are used. */
(function(root){
'use strict';
const norm=v=>String(v??'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c\u200e\u200f]+/g,'').toLowerCase();
// Excel errors are unavailable values, not a reason to reject the worksheet.
const excelError=/^#(?:VALUE!?|DIV\/0!?|REF!?|NAME\?|NUM!?|N\/A!?|NULL!?|SPILL!?|CALC!?|GETTING_DATA|FIELD!?|BLOCKED!?|CONNECT!?|UNKNOWN!?|BUSY!?|PYTHON!?)$/i;
const all=(n,t)=>Array.from(n.getElementsByTagNameNS('*',t));
function xml(b){if(!b)throw Error('ساختار فایل اکسل کامل نیست.');const d=new DOMParser().parseFromString(new TextDecoder().decode(b),'application/xml');if(all(d,'parsererror').length)throw Error('ساختار داخلی اکسل قابل خواندن نیست.');return d;}
function extract(b,names){let size=0;return fflate.unzipSync(b,{filter:f=>{if(!names.includes(f.name))return false;size+=f.originalSize;if(size>32000000)throw Error('شیت بیش از حد بزرگ است.');return true;}});}
function metadata(bytes){if(bytes.length>25000000)throw Error('حداکثر حجم اکسل ۲۵ مگابایت است.');const z=extract(bytes,['xl/workbook.xml','xl/_rels/workbook.xml.rels']);const rels=all(xml(z['xl/_rels/workbook.xml.rels']),'Relationship');return all(xml(z['xl/workbook.xml']),'sheet').map(s=>{
 const id=s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const rel=rels.find(r=>r.getAttribute('Id')===id);if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('ارجاع شیت معتبر نیست.');
 const target=rel.getAttribute('Target');const p=[];for(const bit of (target.startsWith('/')?target.slice(1):'xl/'+target).split('/')){if(bit==='..')p.pop();else if(bit&&bit!=='.')p.push(bit);}return {name:s.getAttribute('name'),path:p.join('/')};
});}
function choose(sheets){return sheets.find(s=>norm(s.name)==='pkj')?.name||sheets.find(s=>norm(s.name).includes('پکیج'))?.name||(sheets.length===1?sheets[0].name:'');}
function fmtInfo(format){
 const currency=format.includes('€')?'€':(/\$\$|"\$"|\\\$|^\$/.test(format)?'$':format.includes('تومان')?'تومان':format.includes('ریال')?'ریال':'');
 const clean=format.replace(/\[[^\]]*\]|"[^"]*"|\\./g,'');const m=clean.match(/\.(0+)/);return {currency,decimals:m?m[1].length:/[0#]/.test(clean)?0:2};
}
function parse(bytes,options={}){
 const sheets=metadata(bytes),name=options.sheetName||choose(sheets);const selected=sheets.find(s=>s.name===name);if(!selected)throw Error('شیت خروجی را از فهرست انتخاب کن.');
 const z=extract(bytes,[selected.path,'xl/sharedStrings.xml','xl/styles.xml']);
 const strings=z['xl/sharedStrings.xml']?all(xml(z['xl/sharedStrings.xml']),'si').map(s=>all(s,'t').map(t=>t.textContent).join('')):[];
 const formats=new Map([[0,'General'],[1,'0'],[2,'0.00'],[3,'#,##0'],[4,'#,##0.00'],[5,'$#,##0'],[6,'$#,##0'],[7,'$#,##0.00'],[8,'$#,##0.00']]);let xfs=[];
 if(z['xl/styles.xml']){const style=xml(z['xl/styles.xml']);for(const n of all(style,'numFmt'))formats.set(+n.getAttribute('numFmtId'),n.getAttribute('formatCode'));const group=all(style,'cellXfs')[0];if(group)xfs=all(group,'xf').map(x=>formats.get(+x.getAttribute('numFmtId'))||'General');}
 const d=xml(z[selected.path]),cells=new Map();
 for(const c of all(d,'c')){const raw=all(c,'v')[0]?.textContent,type=c.getAttribute('t'),formula=all(c,'f').length>0;let value=raw??'';if(type==='s')value=strings[+raw]??'';else if(type==='inlineStr')value=all(c,'t').map(t=>t.textContent).join('');else if(raw!==undefined&&raw!==''&&(!type||type==='n'))value=Number(raw);const format=xfs[+(c.getAttribute('s')||0)]||'General';const error=type==='e'||typeof value==='string'&&excelError.test(value.trim());cells.set(c.getAttribute('r'),{value:error?'—':value,formula,missing:!error&&formula&&(raw===undefined||raw===''),error,errorValue:error?String(value):'',format,...fmtInfo(format)});}
 const rows=all(d,'row').map(r=>+r.getAttribute('r')).sort((a,b)=>a-b);const rowCells=r=>Array.from(cells).filter(([ref])=>+ref.replace(/\D/g,'')===r);
 const sourceHint=norm((options.fileName||'')+' '+name),thailand=sourceHint.includes('پوکت')||sourceHint.includes('تایلند')||sourceHint.includes('phuket')||sourceHint.includes('thailand');
 const headerRow=rows.find(r=>rowCells(r).some(([,c])=>['نامهتل','هتل','hotel','hotelname','hkt'].includes(norm(c.value))));if(!headerRow)throw Error('ستون نام هتل در شیت انتخاب‌شده پیدا نشد.');
 const headers=rowCells(headerRow).map(([ref,c])=>({col:ref.replace(/\d/g,''),label:String(c.value),key:norm(c.value)}));const find=f=>headers.find(h=>f(h.key))?.col;const findLast=f=>headers.filter(h=>f(h.key)).at(-1)?.col;
 const cols={hotel:find(k=>['نامهتل','هتل','hotel','hotelname','hkt'].includes(k)),room:find(k=>['roomtype','نوعاتاق'].includes(k)),city:find(k=>['شهر','city','loc','location'].includes(k)),stars:find(k=>['درجه','ستاره','stars','star'].includes(k)),service:find(k=>['خدمات','service','board'].includes(k)),double:find(k=>(k.includes('دوتخت')||k.includes('دونفره')))||find(k=>k==='dbl'),single:find(k=>(k.includes('یکتخت')||k.includes('تکتخت')))||find(k=>['sgl','sng'].includes(k)),extra:find(k=>['extra','extraperson','نفراضافه','اضافه'].includes(k)),child:find(k=>k.includes('کودک')&&(k.includes('12')||k.includes('۱۲')))||find(k=>k.includes('کودک')&&k.includes('باتخت'))||find(k=>['cwb','chdwb','chdwbed','chdwbed','chdwbed'].includes(k)),small:find(k=>k.includes('کودک')&&!k.includes('12')&&!k.includes('۱۲')&&!k.includes('باتخت'))||find(k=>['chdnobed','cnb','chdwithoutbed'].includes(k))};
 if(thailand){
  cols.double=find(k=>k==='dbl')||find(k=>k.startsWith('dbl'))||cols.double;
  cols.single=findLast(k=>k==='sgl')||findLast(k=>k.startsWith('sgl'))||cols.single;
  cols.child=findLast(k=>k==='wb')||findLast(k=>k==='chd')||cols.child;
  cols.small=findLast(k=>k==='nobed')||findLast(k=>k==='nobedhkt')||cols.small;
  if(!cols.service&&cols.stars)cols.service=cols.stars;
 }
 const thailandCity=thailand?find(k=>k==='bkk'||k.startsWith('bkk')):'';
 if(!cols.service){const sample=rowCells(headerRow+1).find(([,c])=>/^\d\s*[*★]\s*\/?\s*(U?ALL|BB|HB|FB)/i.test(String(c.value)));if(sample)cols.service=sample[0].replace(/\d/g,'');}
 if(!cols.hotel||!cols.double||!cols.single||!cols.child||(!cols.service&&!cols.stars))throw Error('ستون‌های هتل، درجه/خدمات، DBL، SGL و کودک با تخت لازم است.');
 const priceKeys=['double','single',...(cols.extra?['extra']:[]),'child',...(cols.small?['small']:[])];const errors=[];
 function read(col,r){if(!col)return {value:'',currency:'',decimals:0};const c=cells.get(col+r)||{value:'',currency:'',decimals:0};if(c.missing)errors.push(col+r+' (نتیجهٔ فرمول ذخیره نشده)');return {...c};}
 const merges=all(d,'mergeCell').map(m=>m.getAttribute('ref'));const groups=[];let last=headerRow;
 for(const r of rows.filter(r=>r>headerRow)){
  if(r<=last)continue;const cell=cells.get(cols.hotel+r);if(!cell||(!cell.formula&&(typeof cell.value!=='string'||!cell.value.trim())))continue;
  if(PackageSummary.kind(cell.value))continue;
  if(!priceKeys.some(k=>{const c=cells.get(cols[k]+r);return c&&(c.value!==''||c.formula);}))continue;
  const merge=merges.find(m=>m.split(':')[0]===cols.double+r);const end=merge?+merge.split(':')[1].replace(/\D/g,''):r;if(end-r>10)throw Error('ادغام ردیف‌های هتل پشتیبانی نمی‌شود.');
  const hotels=[];for(let hr=r;hr<=end;hr++){const hotel={};for(const key of ['hotel','room','city','stars','service'])hotel[key]=String(read(cols[key],hr).value).trim();if(thailandCity){const bkk=String(read(thailandCity,hr).value).trim();if(bkk)hotel.hotel=[hotel.hotel,bkk].filter(Boolean).join(' + ');}if(cols.service&&cols.service===cols.stars){const combined=hotel.stars.match(/^(.+?[*★])\s*\/\s*(.+)$/);if(combined){hotel.stars=combined[1].trim();hotel.service=combined[2].trim();}else hotel.service='';}if(hotel.hotel)hotels.push(hotel);}
  const prices=Object.fromEntries(priceKeys.map(k=>[k,read(cols[k],r)]));if(hotels.length)groups.push({hotels,prices,sourceRow:r});last=end;
 }
 if(errors.length)throw Error('اکسل را محاسبه و ذخیره کن و دوباره وارد کن. سلول‌های نیازمند بررسی در '+name+': '+[...new Set(errors)].slice(0,8).join('، '));
 if(!groups.length)throw Error('ردیف هتل و قیمت نهایی پیدا نشد.');if(groups.length>300)throw Error('حداکثر ۳۰۰ گزینه پشتیبانی می‌شود.');
 const footer=rows.filter(r=>r>last||r<headerRow).flatMap(r=>rowCells(r).filter(([,c])=>!c.error&&typeof c.value==='string'&&c.value.trim()).map(([ref,c])=>({text:c.value.trim(),ref,header:r<headerRow})));
 const summary=PackageSummary.read(cells,rows,headerRow,last,merges),cards=summary.cards,notes=[],adjustments=[],dateRegex=/[0-9۰-۹]+\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)/;
 PackageSummary.splitTable(groups,priceKeys,cols,headerRow,summary);
 let date='',duration='',title='',stays='',services='';
 for(const {text,ref,header} of footer){
  const key=norm(text);if(!date&&dateRegex.test(text))date=text.match(dateRegex)[0];if(!duration&&/شب.*روز/.test(text))duration=text.match(/[(（]?[^()]*شب[^()]*روز[)）]?/)?.[0]||text;
  if(text.includes('شب')&&text.includes('+')){stays=text;continue;}
  if(summary.consumed.has(ref))continue;
  if(/تاریخ\s*رفت|تاریخ\s*حرکت/.test(text)&&dateRegex.test(text)){
   adjustments.push(text.replace(/\s+/g,' ').replace(/\s+ماه(?=\s|$)/g,'').replace(/([0-9۰-۹][0-9۰-۹.,٬]*)\s+میلیون\s+تومان/g,'$1 تومان').replace(/\s*میباشد/g,' می‌باشد').trim());continue;
  }
  if(!header&&!dateRegex.test(text)&&!text.includes('شب'))notes.push(text);
 }
 const filename=options.fileName||'';if(!date)date=(name+' '+filename).match(dateRegex)?.[0]||'';
 const detect=norm(filename+' '+name+' '+stays),combined=groups.some(g=>g.hotels.length>1),malaysia=detect.includes('کوالا')||detect.includes('kuala');
 const template=malaysia?(detect.includes('لنگکاوی')||detect.includes('langkawi')?'malaysia-langkawi':detect.includes('سنگاپور')||detect.includes('singapore')?'malaysia-singapore':detect.includes('پنانگ')||detect.includes('penang')?'malaysia-penang':'malaysia-kuala'):thailand?(detect.includes('بانکوک')||detect.includes('bangkok')?'thailand-bangkok-phuket':detect.includes('پاتایا')||detect.includes('pattaya')?'thailand-pattaya':'thailand-phuket'):combined?'combined':detect.includes('bodrum')||detect.includes('بدروم')?'bodrum':detect.includes('کوش')||detect.includes('kus')?'kus':detect.includes('آنتالیا')||detect.includes('antalya')?'antalya':'';
 if(combined){const cities=[...new Set(groups.flatMap(g=>g.hotels.map(h=>h.city)).filter(Boolean))];title=cities.length?cities.join(' + '):'کوش آداسی + ازمیر';}
 if(!title)title=malaysia?'مالزی':template==='thailand-bangkok-phuket'?'بانکوک + پوکت':template==='thailand-pattaya'?'پاتایا':template==='thailand-phuket'?'پوکت':template==='bodrum'?'بدروم':template==='kus'?'کوش آداسی':template==='antalya'?'آنتالیا':'';
 if(thailand){
  const info=footer.find(x=>/شب.*روز/.test(x.text));
  if(info){
   const match=info.text.match(/\d+\s*شب\s*و\s*\d+\s*روز|[۰-۹]+\s*شب\s*و\s*[۰-۹]+\s*روز/);
   if(match)duration=match[0];
   services=info.text.replace(match?.[0]||'','').replace(/^\s*[،,:-]+\s*/,'').trim();
  }
  const cardFrom=(key,label,re)=>{const item=footer.find(x=>re.test(x.text));if(!item)return;const m=item.text.match(re);cards[key]={value:(m?.[1]||item.text).trim(),unit:'',label,ref:item.ref,automatic:true};summary.consumed.add(item.ref);};
  cardFrom('flightDays','روزهای پرواز',/روزهای\s*پرواز\s*(.*)$/);
  cardFrom('departureTime','ساعت رفت',/ساعت\s*رفت\s*[:：]?\s*([0-9۰-۹:]+)/);
  cardFrom('returnTime','ساعت برگشت',/ساعت\s*برگشت\s*[:：]?\s*([0-9۰-۹:]+)/);
  if(services)services=services.replace(/،?\s*کمیسیون.*$/,'').trim();
  const commission=cards.commission;
  if(commission&&typeof commission.value==='number'&&commission.value>1000000000){const grouped=String(commission.raw||'').match(/[0-9۰-۹]+(?:[.,٬،][0-9۰-۹]{3})+/);if(grouped){commission.value=PackageSummary.money(grouped[0]);commission.unit=commission.unit||'تومان';}}
 }
 if(malaysia){
  const dates=adjustments.map(t=>t.match(/تاریخ\s*(?:رفت|حرکت)\s*([0-9۰-۹]+)\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)/)?.slice(1)).filter(Boolean);
  if(dates.length){const months=[...new Set(dates.map(d=>d[1]))];date=dates.map(d=>d[0]).join(' / ')+(months.length===1?' '+months[0]:' '+months.join(' / '));}
 duration=template==='malaysia-penang'?'۴ شب کوالالامپور و ۳ شب پنانگ':template==='malaysia-singapore'?'۷ شب کوالالامپور و سنگاپور':template==='malaysia-langkawi'?'۷ شب کوالالامپور + لنگکاوی':'۷ شب کوالالامپور';
  for(const card of Object.values(cards))if(!card.unit)card.unit='تومان';
  for(const g of groups){for(const h of g.hotels){h.hotel=h.hotel.replace(/\s*\+\s*/g,' + ').replace(/\s+/g,' ').trim();if(!cols.service)h.service='';}for(const k of priceKeys){const c=g.prices[k];if(c.value==='N/A')c.value='—';if(!c.currency&&!c.error&&!c.missing&&c.value!==''&&c.value!=='—')c.currency='$';}}
 }
 if(thailand){
  for(const g of groups)for(const k of priceKeys){const c=g.prices[k];if(!c.currency&&!c.error&&!c.missing&&c.value!==''&&c.value!=='—')c.currency='$';}
 }
 const errorCells=Array.from(cells).filter(([,c])=>c.error);
 const errorWarnings=errorCells.length?['سلول‌های خطادار اکسل با «—» نمایش داده می‌شوند: '+errorCells.slice(0,8).map(([ref,c])=>ref+' ('+c.errorValue+')').join('، ')+(errorCells.length>8?'، …':'')]:[];
 const currencies=[...new Set(groups.flatMap(g=>priceKeys.map(k=>g.prices[k].currency)).filter(Boolean))];
 return {groups,priceKeys,hasRoom:!!cols.room,hasCity:!!cols.city,cards,notes:notes.join('\n'),adjustments:adjustments.join('\n'),services,date,duration,stays,title,template,sheetName:name,sheetNames:sheets.map(s=>s.name),currencies,warnings:[...errorWarnings,...summary.warnings.filter(w=>!malaysia&&!thailand||!w.startsWith('واحد «')),...(malaysia?['مدت اقامت و خدمات سفر در اکسل درج نشده‌اند؛ متن پیش‌فرض قالب قابل ویرایش است.']:[]),...(Array.from(cells.values()).some(c=>c.formula)?['نتیجهٔ ذخیره‌شدهٔ فرمول‌ها خوانده شد؛ برنامه محاسبهٔ مجدد انجام نمی‌دهد.']:[])]};
}
root.PKJ={parse,list:bytes=>metadata(bytes).map(s=>s.name),choose:names=>choose(names.map(name=>({name}))),norm};
})(globalThis);
