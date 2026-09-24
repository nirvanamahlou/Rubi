/* Local DOCX tables and tour text. No upload or remote conversion. */
window.WordPackage=(()=>{
 const kids=(node,name)=>Array.from(node?.children||[]).filter(x=>x.localName===name);
 const text=node=>Array.from(node?.getElementsByTagName('*')||[]).map(x=>x.localName==='t'?x.textContent:x.localName==='br'?'\n':'').join('').trim();
 const cellText=cell=>kids(cell,'p').map(text).filter(Boolean).join('\n').trim();
 const latin=value=>String(value).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
 const clean=value=>String(value).replace(/\s+/g,' ').trim();
 const price=value=>{
  const raw=clean(value),match=latin(raw).match(/[0-9][0-9,٬.]*/);
  if(!match)return {value:'—',currency:'',missing:true,error:false};
  return {value:Number(match[0].replace(/[,٬.]/g,'')),currency:/یورو|€/.test(raw)?'€':/دلار|\$/.test(raw)?'$':'',suffix:/نرخ\s*پرواز/.test(raw)?'+ نرخ پرواز':'',missing:false,error:false,decimals:0};
 };
 function parse(bytes,{fileName='' }={}){
  if(bytes.length<4||bytes[0]!==80||bytes[1]!==75)throw Error('فایل Word معتبر نیست.');
  const zip=fflate.unzipSync(bytes),xmlBytes=zip['word/document.xml'];if(!xmlBytes)throw Error('متن اصلی فایل Word پیدا نشد.');
  const xml=new DOMParser().parseFromString(new TextDecoder().decode(xmlBytes),'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw Error('ساختار Word قابل خواندن نیست.');
  const body=Array.from(xml.getElementsByTagName('*')).find(n=>n.localName==='body');
  if(!body)throw Error('متن فایل Word پیدا نشد.');
  const paras=kids(body,'p').map(text).filter(Boolean),tables=kids(body,'tbl');
  const table=tables.map(t=>kids(t,'tr').map(r=>kids(r,'tc').map(cellText))).find(rows=>rows.length>1&&rows[0].some(c=>/هتل/.test(c)));
  if(!table)throw Error('جدول نام هتل و نرخ در Word پیدا نشد.');
  const subject=clean(paras.slice(0,3).join(' ')+fileName);
  const combined=/پاریس|فرانسه|paris/i.test(subject),madrid=!combined&&/مادرید|madrid/i.test(subject);
  const template=combined?'spain-combined':madrid?'spain-madrid':'spain-barcelona';
  const month=paras.find(s=>/فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند/.test(s))||'';
  const departure=paras.find(s=>/تاریخ\s*(حرکت)?/.test(s))||'';
  const dates=latin(departure).match(/\d+/g)||[],year=latin(month).match(/1[34]\d{2}/)?.[0]||'';
  const monthName=month.match(/فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند/)?.[0]||'';
  const date=dates.length?dates.join(' و ')+(monthName?' '+monthName:'')+(year?' '+year:''):clean(departure+' '+month);
  const baseDuration=paras.find(s=>/\d+\s*شب.*\d+\s*روز/.test(latin(s)))||'';
  const city=combined?'بارسلون + پاریس':madrid?'مادرید':'بارسلون';
  const duration=combined?clean(paras.find(s=>/بارسلون.*پاریس/.test(s))||'')+'\n'+clean(baseDuration):clean(baseDuration+' '+city);
  const serviceIndex=paras.findIndex(s=>/خدمات\s*تور/.test(s));
  const services=serviceIndex>=0?clean(paras[serviceIndex+1]||''):'';
  const noteIndex=paras.findIndex(s=>/توجه/.test(s));
  const notes=noteIndex>=0?paras.slice(noteIndex+1).filter(Boolean).map(s=>'• '+clean(s)).join('\n'):'';
  const groups=[],priceKeys=['double','single','child','small'];
  for(const row of table.slice(1)){
   if(row.length<7||!row[6].trim())continue;
   const prices={small:price(row[0]),child:price(row[1]),single:price(row[2]),double:price(row[3])};
   const service=clean(row[4].replace(/\n/g,' ')),stars=clean(row[5].replace(/\n/g,' '));
   let names=[clean(row[6].replace(/\n/g,' '))];
   if(combined&&/Novotel/i.test(row[6])){
    const split=row[6].replace(/\s*\/Similar/gi,'').split(/(?=Novotel)/i).map(clean).filter(Boolean);
    if(split.length>1)names=split;
   }
   names.forEach((name,part)=>groups.push({hotels:[{hotel:name,stars:combined?(part?stars.split(' ')[1]||stars:stars.split(' ')[0]||stars):'',service:combined?'BB':clean(stars+'/'+service),city}],prices:structuredClone(prices)}));
  }
  if(!groups.length)throw Error('ردیف قیمت در Word پیدا نشد.');
  const cards={taxi:{value:'به عهده مسافر',unit:'',label:'سیتی تاکس'},infant:{value:'تماس بگیرید',unit:'',label:'نوزاد زیر ۲ سال'},stay:{value:baseDuration,unit:'',label:'اقامت'},departure:{value:date,unit:'',label:'تاریخ حرکت'}};
  return {groups,priceKeys,hasRoom:false,hasCity:false,cards,notes,services,adjustments:'',date,duration,stays:'',title:TEMPLATES[template].title,template,
   sheetName:fileName,sheetNames:[],currencies:['€'],warnings:[...(combined?['ردیف دوم Word دو هتل دارد؛ نرخ‌های همان ردیف برای هر دو هتل نمایش داده می‌شود.']:[]),'مبلغ پرواز جداگانه در Word درج نشده است؛ نرخ‌های هتل با «+ نرخ پرواز» نشان داده می‌شوند.']};
 }
 return {parse};
})();
