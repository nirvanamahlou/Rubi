/* Istanbul artwork supplied for the three- and four-night package sheets. */
(function(){
const slot=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const common={externalImage:true,fixedCardSlots:true,title:'استانبول',color:'#10162a',adjustmentsDefault:''};
TEMPLATES['istanbul-3']={...common,label:'استانبول · ۳ شب',style:'istanbul-3',image:'istanbul-3.png',width:1092,height:1441,
 columns:[31,18,12,12,13,14],font:16,minFont:11,rows:29,headerBox:[220,308,848,44],body:[220,352,848,751],date:[239,218,240,51],
 titleBox:[498,24,335,131],durationBox:[570,159,235,55],durationHole:[558,157,254,63],servicesBox:[220,1231,847,107],
 cardSlots:[slot('flightSchedule','پرواز تابان',219,1171,219,39),slot('commission','کمیسیون',456,1155,192,55),slot('small','کودک بدون تخت',666,1155,196,55),slot('adult','نرخ پرواز',877,1155,184,55)]};
TEMPLATES['istanbul-4']={...common,label:'استانبول · ۴ شب',style:'istanbul-4',image:'istanbul-4.png',width:1122,height:1402,
 columns:[30,19,17,17,17],font:16,minFont:11,rows:28,headerBox:[213,282,887,47],body:[213,329,887,723],date:[232,212,237,50],
 titleBox:[496,24,340,132],durationBox:[565,156,245,55],durationHole:[555,153,263,64],servicesBox:[211,1180,889,117],
 cardSlots:[slot('flightSchedule','پرواز تابان',214,1119,222,40),slot('commission','کمیسیون',450,1099,194,61),slot('small','کودک بدون تخت',664,1099,202,61),slot('adult','نرخ پرواز',884,1099,205,61)]};
})();

