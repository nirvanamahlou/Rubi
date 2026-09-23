'use strict';
// Reflow the price cards within the original page, keeping services/footer fixed.
window.PackageCards=(()=>{
 const models={},customValues={};let serial=0;
 const geometry={
  combined:{band:[227,1035,873,90],panel:[209,265,893,764],gap:10,rowGap:10,radius:17,color:'#6c9fda',tableColor:'#858585'},
  kus:{band:[238,1016,867,97],panel:[237,251,868,756],gap:8,rowGap:10,radius:18,color:'#739cff',tableColor:'#a9a9a9'},
  antalya:{band:[213,1118,886,97],panel:[203,224,895,887],gap:9,rowGap:10,radius:14,color:'#243e85',tableColor:'#122961'},
  bodrum:{band:[227,1188,762,102],panel:[225,271,765,903],gap:9,rowGap:10,radius:18,color:'#8099ad',tableColor:'#909090'},
  nss:{band:[227,1108,777,85],panel:[226,266,777,832],gap:9,rowGap:10,radius:18,color:'#797fc2',tableColor:'#858585'},
  'malaysia-kuala':{band:[183,978,650,84],panel:[183,274,650,696],gap:4,rowGap:7,radius:12,color:'#478aff',tableColor:'#c2d1e9'},
  'malaysia-penang':{band:[198,977,786,85],panel:[197,271,791,699],gap:5,rowGap:7,radius:12,color:'#478aff',tableColor:'#c2d1e9'},
  'malaysia-singapore':{band:[203,977,736,84],panel:[202,273,738,696],gap:5,rowGap:7,radius:12,color:'#478aff',tableColor:'#c2d1e9'},
  'malaysia-langkawi':{band:[153,798,553,73],panel:[153,234,552,558],gap:4,rowGap:6,radius:11,color:'#478aff',tableColor:'#c2d1e9'},
  'thailand-phuket':{band:[161,700,591,78],panel:[159,195,595,499],gap:6,rowGap:8,radius:12,color:'#0b4c91',tableColor:'#b8c8d8'},
  'thailand-bangkok-phuket':{band:[154,739,585,72],panel:[153,200,586,531],gap:6,rowGap:8,radius:12,color:'#0b4c91',tableColor:'#b8c8d8'},
  'thailand-pattaya':{band:[141,793,563,73],panel:[140,195,565,593],gap:6,rowGap:8,radius:12,color:'#0b4c91',tableColor:'#b8c8d8'},
  'spain-barcelona':{band:[154,1073,781,153],panel:[162,451,773,605],gap:7,rowGap:9,radius:14,color:'#478aff',tableColor:'#c2d1e9'},
  'spain-madrid':{band:[170,1080,765,153],panel:[177,432,759,630],gap:7,rowGap:9,radius:14,color:'#478aff',tableColor:'#c2d1e9'},
  'spain-combined':{band:[153,960,783,165],panel:[155,490,782,451],gap:7,rowGap:9,radius:14,color:'#478aff',tableColor:'#c2d1e9'}
 };
 const base=()=>TEMPLATES[$('template').value];
 function model(){const p=base();return models[p.style]||=( {dirty:false,slots:p.cardSlots.map(s=>({key:s.key,label:s.label}))} );}
 function title(slot){return window.PackageEditor?.text('label_'+slot.key,slot.label)??slot.label;}
 function maxCount(){const p=base(),g=geometry[p.style];return 5*(1+Math.floor((p.body[3]-Math.max(200,p.body[3]/p.rows*5))/(g.band[3]+g.rowGap)));}
 function layout(p=base()){
  const m=model(),g=geometry[p.style],count=m.slots.length,rows=Math.ceil(count/5),bottom=g.band[1]+g.band[3],panelBottom=g.panel[1]+g.panel[3];
  const delta=count?(rows-1)*(g.band[3]+g.rowGap):panelBottom-bottom;
  const top=g.band[1]-delta,slots=[];let index=0;
  for(let row=0;row<rows;row++){
   const columns=Math.ceil((count-index)/(rows-row)),width=(g.band[2]-(columns-1)*g.gap)/columns;
   for(let col=0;col<columns;col++){
    const source=m.slots[index++],x=g.band[0]+col*(width+g.gap),y=top+row*(g.band[3]+g.rowGap),height=g.band[3];
    slots.push({...source,frameBox:[x,y,width,height],labelBox:[x+8,y+6,width-16,34],box:[x+8,y+42,width-16,height-47]});
   }
  }
  return {delta,slots,rows,bottom,panelBottom:panelBottom-delta};
 }
 function adjustedProfile(p){
  if(!model().dirty)return p;const l=layout(p),body=[...p.body];body[3]-=l.delta;
  return {...p,body,rows:Math.max(1,Math.floor(p.rows*body[3]/p.body[3])),cardSlots:l.slots};
 }
 function holes(){
  if(!model().dirty)return [];const p=base(),g=geometry[p.style],l=layout(p),top=Math.min(g.panel[1]+g.panel[3],l.panelBottom)-g.radius-2;
  const left=Math.min(g.panel[0],g.band[0])-2,right=Math.max(g.panel[0]+g.panel[2],g.band[0]+g.band[2])+2;
  return [[left,top,right-left,l.bottom-top+2]];
 }
 function artwork(){
  if(!model().dirty)return '';const p=base(),g=geometry[p.style],l=layout(p),w=g.panel[2],r=g.radius,h=r+2;
  const curve=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M .75 0 H ${w-.75} V 2 Q ${w-.75} ${h-.75} ${w-r} ${h-.75} H ${r} Q .75 ${h-.75} .75 2 Z" fill="${p.style==='antalya'?'#fff':'#f7f7f7'}"/><path d="M .75 0 V 2 Q .75 ${h-.75} ${r} ${h-.75} H ${w-r} Q ${w-.75} ${h-.75} ${w-.75} 2 V 0" fill="none" stroke="${g.tableColor}" stroke-width="1.3"/></svg>`;
  let html=place('reflow-table-border',[g.panel[0],l.panelBottom-h,w,h],curve);
  for(const slot of l.slots)html+=place('price-card-frame',slot.frameBox,'').replace('style="',`data-card-frame="${slot.key}" style="border-color:${g.color};`);
  return html;
 }
 function syncTitles(){
  for(const slot of profile().cardSlots){const input=$('cards').querySelector(`[data-card-title="${slot.key}"]`);if(input&&input!==document.activeElement)input.value=title(slot);}
  const count=profile().cardSlots.length,m=model();$('importCards').disabled=state.busy||!state.data;$('addCard').disabled=state.busy||count>=maxCount();$('resetCards').disabled=state.busy||!m.dirty;
  $('cardCount').textContent=count?`${fa(count)} کادر${m.dirty?' در '+fa(layout().rows)+' ردیف':''}`:'بدون کادر قیمت؛ فضای آن به جدول اختصاص پیدا می‌کند.';
 }
 function refresh(focus){state.reference=false;$('reference').textContent='نمایش مرجع';drawCards();render();syncTitles();if(focus){const input=$('cards').querySelector(`[data-card-title="${focus}"]`);input?.focus({preventScroll:true});input?.select();}}
 function add(){if(state.busy||model().slots.length>=maxCount())return;const key='custom_card_'+(++serial),m=model();m.dirty=true;m.slots.push({key,label:'عنوان جدید'});state.cards[key]={value:'',unit:'تومان'};refresh(key);}
 function remove(key){if(state.busy)return;const m=model();if(!m.slots.some(s=>s.key===key))return;m.dirty=true;m.slots=m.slots.filter(s=>s.key!==key);refresh();}
 function reset(){if(state.busy)return;delete models[base().style];refresh();}
 function includeSource(source){
  const m=model();for(const [key,c] of Object.entries(source)){
   if(key==='infant'&&base().style==='combined'||m.slots.some(s=>s.key===key))continue;
   m.slots.push({key,label:c.label||key});m.dirty=true;
  }
 }
 function reloadSource(){
  if(state.busy||!state.data)return;
  for(const [key,c] of Object.entries(state.data.cards))state.cards[key]=structuredClone(c);
  includeSource(state.data.cards);
  if(base().style==='combined'){$('infantValue').value=state.data.cards.infant?.value??'';$('infantUnit').value=state.data.cards.infant?.unit||'';}
  refresh();message('مبالغ و ارزها دوباره از اکسل پر شدند؛ می‌توانی هر کادر را ویرایش کنی.');
 }
 $('importCards').addEventListener('click',reloadSource);
 function rememberCustom(){for(const [key,value] of Object.entries(state.cards))if(key.startsWith('custom_card_'))customValues[key]=structuredClone(value);}
 function dataForImport(source){rememberCustom();return {...structuredClone(source),...structuredClone(customValues)};}
 $('addCard').addEventListener('click',add);$('resetCards').addEventListener('click',reset);
 $('cards').addEventListener('click',event=>{const button=event.target.closest('[data-remove-card]');if(button)remove(button.dataset.removeCard);});
 setTimeout(()=>{drawCards();syncTitles();},0);
 return {profile:adjustedProfile,title,includeSource,holes,artwork,syncTitles,rememberCustom,dataForImport,get active(){return model().dirty;}};
})();
