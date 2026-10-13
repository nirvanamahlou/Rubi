'use strict';
// Rebuilding a preview briefly shortens the document and clamps its scroll offset.
// Keep one snapshot through the synchronous render and alignment-control microtasks.
window.ScrollPosition=(()=>{
 let pending=null,frame=0,depth=0;
 function capture(){
  return {x:window.scrollX,y:window.scrollY,regions:[...document.querySelectorAll('.controls,#pages,#bannerPages,#hotelDialog[open],#visaCountryDialog[open]')].filter(el=>el.getClientRects().length).map(el=>({el,x:el.scrollLeft,y:el.scrollTop}))};
 }
 function restore(view){
  for(const {el,x,y} of view.regions)if(el.isConnected&&el.getClientRects().length)el.scrollTo({left:x,top:y,behavior:'instant'});
  window.scrollTo({left:view.x,top:view.y,behavior:'instant'});
 }
 function cancel(){if(frame)cancelAnimationFrame(frame);frame=0;pending=null;}
 function keep(update){
  if(depth)return update();
  const view=pending||capture();pending=view;depth++;
  try{return update();}finally{
   depth--;restore(view);
   if(!frame)frame=requestAnimationFrame(()=>{frame=0;const saved=pending;pending=null;if(saved)restore(saved);});
  }
 }
 // Never undo a new scroll, click, or keyboard navigation while a frame is pending.
 for(const event of ['wheel','touchstart','pointerdown','keydown'])document.addEventListener(event,cancel,{capture:true,passive:true});
 return {keep};
})();
