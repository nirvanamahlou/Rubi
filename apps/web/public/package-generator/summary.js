/* Read labelled summary prices from the selected worksheet only. */
(function(root){
'use strict';
const latin=v=>String(v??'').replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
const norm=v=>latin(v).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c\u200e\u200f]+/g,'').toLowerCase();
const unitPattern=/تومان|تومن|ریال|یورو|دلار|EUR|USD|IRR|€|\$|٪|%/gi;
function unit(v){const t=String(v??'');if(/€|یورو|\bEUR\b/i.test(t))return '€';if(/\$|دلار|\bUSD\b/i.test(t))return '$';if(/تومان|تومن/.test(t))return 'تومان';if(/ریال|\bIRR\b/i.test(t))return 'ریال';if(/٪|%/.test(t))return '٪';return '';}
function kind(text){
 const t=norm(text);
 if(/hotel|هتل/.test(t))return '';
 if(/کمیسیون|کمیسون|commission/.test(t))return 'commission';
 if(/بیزینس|بیزنس|business/.test(t))return 'business';
 if(/نوزاد|infant/.test(t))return 'infant';
 if(/بدونتخت|بدونصندلی|cnb|chdno?bed/.test(t))return 'small';
 if(/^کودک(?:[:：]|\d)/.test(t))return 'childFlight';
 if((/پرواز|بلی[تط]|airfare|flight|ticket/.test(t))&&/کودک|بچه|child|chd/.test(t))return 'childFlight';
 if(/^(?:نرخ|هزینه|قیمت|مبلغ)?(?:پرواز|بلی[تط])|^(?:adult)?(?:airfare|flight|ticket)/.test(t))return 'adult';
 // Additional labelled charges become editable cards rather than disappearing in notes.
 if(/^(نرخ|هزینه|قیمت|مبلغ)/.test(t)&&!t.includes('هتل')){const label=t.split(/[:：=\d]/)[0];let hash=0;for(const c of label)hash=(hash*31+c.charCodeAt(0))>>>0;return 'source_card_'+hash.toString(36);}
 return '';
}
function money(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let s=latin(value).replace(unitPattern,'').trim().replace(/[.:：]+$/,'').trim();if(!s)return null;
 const multiplier=/میلیارد/.test(s)?1e9:/میلیون/.test(s)?1e6:/هزار/.test(s)?1e3:1;s=s.replace(/میلیارد|میلیون|هزار/g,'').trim();
 if(!/^-?\d[\d\s.,/٬٫،]*$/.test(s))return null;
 s=s.replace(/\s/g,'');
 const grouped=/^-?\d{1,3}(?:[.,/٬،]\d{3})+$/;
 if(grouped.test(s))s=s.replace(/[.,/٬،]/g,'');
 else if(!/^-?\d+(?:\.\d+)?$/.test(s)){
  // A decimal suffix is not another thousands group (4.000.000.0 = 4 million).
  const decimal=s.match(/^(-?[\d.,/٬،]+)[٫](\d+)$/)||s.match(/^(-?[\d.,/٬،]+)[.,](\d{1,2})$/);
  if(!decimal||!(/^-?\d+$/.test(decimal[1])||grouped.test(decimal[1])))return null;
  s=decimal[1].replace(/[.,/٬،]/g,'')+'.'+decimal[2];
 }
 const n=Number(s)*multiplier;return Number.isFinite(n)?n:null;
}
function importedMoney(raw){
 // Repair only the source's malformed final 0000 group, never a valid large amount.
 const text=latin(raw).replace(unitPattern,'').trim(),match=text.match(/^(-?\d{1,3})([./,٬،])((?:\d{3}\2)+)0000$/);
 if(match){const corrected=text.slice(0,-1);return {value:money(corrected),raw:String(raw),normalization:{original:String(raw),corrected}};}
 return {value:money(raw),raw:String(raw)};
}
function column(ref){let n=0;for(const c of ref.replace(/\d/g,''))n=n*26+c.charCodeAt(0)-64;return n;}
function inline(text){
 const split=String(text).split(/[:：=]/),body=split.length>1?split.slice(1).join(':'):String(text);
 const clean=latin(body).replace(/\(?\d+\s*(?:[-–—]|تا|الی)\s*\d+\s*سال\)?/g,'').replace(/\d+\s*سال/g,'');
 const tokens=clean.match(/-?\d+(?:[.,/٬٫،]\d+|\s+\d{3}(?!\d))*(?:\s*(?:میلیارد|میلیون|هزار))?/g)||[];
 if(tokens.length!==1)return null;const found=importedMoney(tokens[0]);return found.value===null?null:found;
}
function read(cells,rows,headerRow,lastRow,merges){
 const area=rows.filter(r=>r<headerRow||r>lastRow),byRow=new Map(),labels=[],warnings=[],cards={},consumed=new Set();
 for(const [ref,c] of cells){const row=+ref.replace(/\D/g,'');if(!area.includes(row))continue;const cell={...c,ref,row,col:column(ref)};if(!byRow.has(row))byRow.set(row,[]);byRow.get(row).push(cell);}
 for(const entries of byRow.values())entries.sort((a,b)=>a.col-b.col);
 for(const entries of byRow.values())for(const cell of entries){if(typeof cell.value!=='string')continue;for(const text of cell.value.split(/[\r\n;؛|]+/).map(t=>t.trim()).filter(Boolean)){const key=kind(text);if(key)labels.push({cell,text,key});}}
 const isValue=c=>c.error||c.formula&&c.missing||importedMoney(c.value).value!==null;
 const rowLabels=r=>labels.filter(l=>l.cell.row===r);
 for(const entry of labels){
  const {cell,text,key}=entry,own=inline(text),same=byRow.get(cell.row)||[],siblings=rowLabels(cell.row),firstLabel=Math.min(...siblings.map(l=>l.cell.col));
  const before=same.some(c=>c.col<firstLabel&&isValue(c)),direction=before?-1:1;
  const next=siblings.filter(l=>direction*(l.cell.col-cell.col)>0).sort((a,b)=>direction*(a.cell.col-b.cell.col))[0];
  const related=[];let source=cell,found=own;
  if(!found){
   const candidates=same.filter(c=>direction*(c.col-cell.col)>0&&(!next||direction*(c.col-next.cell.col)<0)&&isValue(c)).sort((a,b)=>direction*(a.col-b.col));
   if(candidates.length===1)source=candidates[0];
   else if(candidates.length>1){warnings.push('بیش از یک مبلغ برای «'+text+'» پیدا شد؛ کادر را دستی تکمیل کن.');}
   else{
    const range=merges.find(m=>m.split(':')[0]===cell.ref),end=range?column(range.split(':')[1]):cell.col;
    for(let dy=1;dy<=2;dy++){
     const line=byRow.get(cell.row+dy)||[];if(rowLabels(cell.row+dy).some(l=>l.cell.col>=cell.col&&l.cell.col<=end))break;
     const below=line.filter(c=>c.col>=cell.col&&c.col<=end&&isValue(c));
     if(below.length===1){source=below[0];break;}if(below.length>1)break;
    }
   }
   if(source!==cell){found=importedMoney(source.value);related.push(source);}
  }
  const unitCell=c=>typeof c.value==='string'&&unit(c.value)&&!c.value.replace(unitPattern,'').replace(/واحد|مبالغ|مبلغ|ارز|[:：=\s()]/g,'');
  const rowUnits=(byRow.get(source.row)||[]).filter(unitCell);
  const belowUnit=(byRow.get(source.row+1)||[]).find(c=>c.col===source.col&&unitCell(c));
  const nearby=rowUnits.sort((a,b)=>Math.abs(a.col-source.col)-Math.abs(b.col-source.col))[0]||belowUnit;
  if(nearby)related.push(nearby);
  let currency=unit(source===cell?text:source.value)||source.currency||unit(text)||unit(nearby?.value)||unit(source.format),value=found?.value??'';
  if(currency==='٪'&&typeof source.value==='number'&&/%/.test(source.format))value=source.value*100;
  const rawValue=value;if(typeof source.value==='number'&&typeof value==='number')value=Number(value.toFixed(Math.min(10,source.decimals??2)));
  if(source.error){value='';warnings.push('مبلغ «'+text+'» در '+source.ref+' خطادار است و با «—» نمایش داده می‌شود؛ می‌توانی مبلغ را دستی ویرایش کنی.');}
  else if(source.missing){value='';warnings.push('مبلغ «'+text+'» در '+source.ref+' نتیجهٔ ذخیره‌شدهٔ معتبر ندارد؛ آن را دستی وارد کن یا اکسل را محاسبه و ذخیره کن.');}
  const label=text.split(/[:：=]/)[0].replace(/\s*[€$]?\s*[0-9۰-۹٠-٩][0-9۰-۹٠-٩.,/٬٫،\s]*(?:تومان|ریال|یورو|دلار)?\s*$/,'').trim();
  const card={value,unit:currency,ref:source.ref,labelRef:cell.ref,label:label||text,raw:found?.raw??'',rawValue,automatic:true};
  if(found?.normalization){card.normalization=found.normalization;warnings.push('گروه‌بندی مبلغ در '+source.ref+' از «'+found.normalization.original+'» به «'+found.normalization.corrected+'» اصلاح شد؛ مبلغ کادر قابل ویرایش است.');}
  if(cards[key]?.conflict){consumed.add(cell.ref);for(const c of related)consumed.add(c.ref);continue;}
  if(cards[key]&&cards[key].value!==''&&value!==''&&(cards[key].value!==value||cards[key].unit&&currency&&cards[key].unit!==currency)){
   card.value='';card.conflict=true;card.ref=cards[key].ref+'، '+source.ref;warnings.push('برای «'+label+'» چند مبلغ متفاوت درج شده است؛ مبلغ کادر را دستی تعیین کن.');
  }
  if(!cards[key]||cards[key].value===''||value!==''||card.conflict)cards[key]=card;
  consumed.add(cell.ref);for(const c of related)consumed.add(c.ref);
 }
 // An explicit common unit in this summary can label its other charges, never the hotel table.
 const units=[...new Set(Object.values(cards).map(c=>c.unit).filter(u=>u&&u!=='٪'))];
 for(const c of Object.values(cards))if(!c.unit&&units.length===1){c.unit=units[0];c.unitInherited=true;}
 // Persian travel price summaries often omit «تومان» after grouped million amounts.
 // Infer it only for large Persian-labelled values, leaving smaller/foreign values untouched.
 for(const c of Object.values(cards))if(!c.unit&&typeof c.value==='number'&&Math.abs(c.value)>=100000&&/[\u0600-\u06ff]/.test(c.label||'')&&/[.,/٬،]\d{3}[.,/٬،]\d{3}/.test(latin(c.raw||''))){c.unit='تومان';c.unitInferred=true;}
 for(const c of Object.values(cards))if(c.value!==''&&!c.unit)warnings.push('واحد «'+c.label+'» در خلاصهٔ اکسل مشخص نیست؛ از فهرست همان کادر انتخاب کن.');
 return {cards,warnings,consumed};
}
// Split only complete, explicitly labelled amounts. Never add or convert currencies.
function splitPrice(value){
 if(typeof value!=='string')return null;
 const pieces=value.replace(/[\u200e\u200f\u061c]/g,'').split(/[+＋]/).map(t=>t.trim());
 if(pieces.length>2)return null;
 const parsed=pieces.map(raw=>({raw,value:money(raw),unit:unit(raw)}));
 if(parsed.some(p=>p.value===null||!p.unit||p.unit==='٪'))return null;
 const local=parsed.filter(p=>['تومان','ریال'].includes(p.unit)),foreign=parsed.filter(p=>['€','$'].includes(p.unit));
 if(local.length!==1||foreign.length>1||parsed.length!==local.length+foreign.length)return null;
 return {local:local[0],foreign:foreign[0]||null};
}
function splitTable(groups,priceKeys,cols,headerRow,summary){
 const parsed=groups.map(g=>Object.fromEntries(priceKeys.map(k=>[k,splitPrice(g.prices[k].value)])));
 if(!parsed.some(row=>Object.values(row).some(p=>p?.foreign)))return;
 const records={double:[],single:[],child:[],small:[]};
 const empty=v=>v===''||v==null||/^(?:n\/?a|—|-)$/i.test(String(v).trim());
 const smallOnly=priceKeys.includes('small')&&groups.some((g,i)=>parsed[i].small?.local)&&groups.every((g,i)=>empty(g.prices.small.value)||parsed[i].small&&!parsed[i].small.foreign);
 groups.forEach((g,i)=>{
  for(const k of priceKeys){
   const p=parsed[i][k],c=g.prices[k];
   if(!p||(!p.foreign&&k!=='small'))continue;
   records[k].push({...p.local,ref:cols[k]+g.sourceRow});
   c.sourceValue=c.value;c.localComponent={...p.local};
   if(p.foreign){c.value=p.foreign.value;c.currency=p.foreign.unit;c.decimals=10;}
   else if(smallOnly){c.value='—';c.currency='';}
  }
 });
 const compact=refs=>{const r=[...new Set(refs)];return r.length>4?r.slice(0,2).join('، ')+' … '+r.slice(-2).join('، '):r.join('، ');};
 function add(key,label,items){
  if(!items.length)return;
  const first=items[0],refs=items.map(x=>x.ref),conflict=items.some(x=>x.value!==first.value||x.unit!==first.unit);
  const card={value:conflict?'':first.value,unit:first.unit,label,ref:compact(refs),sourceRefs:refs,labelRef:first.ref.replace(/\d+$/,String(headerRow)),raw:first.raw,rawValue:first.value,automatic:true,fromTable:true,conflict};
  const prior=summary.cards[key];
  if(prior?.conflict||prior&&prior.value!==''&&(prior.value!==card.value||prior.unit&&prior.unit!==card.unit)){card.value='';card.conflict=true;card.ref=compact([prior.ref,...refs]);}
  summary.cards[key]=card;
  if(card.conflict)summary.warnings.push('مبلغ تومانی/ریالی «'+label+'» در '+card.ref+' یکسان نیست؛ مبلغ کادر را دستی تعیین کن.');
 }
 add('adult','نرخ پرواز بزرگسال',[...records.double,...records.single]);
 add('childFlight','نرخ پرواز کودک با تخت',records.child);
 add('small','کودک بدون تخت',records.small);
 if(smallOnly){priceKeys.splice(priceKeys.indexOf('small'),1);for(const g of groups)delete g.prices.small;}
 summary.warnings.push('قیمت‌های ارزی از مبلغ تومانی/ریالی جدا شدند؛ بخش ارزی در جدول و مبالغ مشترک بر اساس ستون در کادرهای پایین قرار گرفتند.');
}
root.PackageSummary={kind,money,read,splitPrice,splitTable};
})(globalThis);
