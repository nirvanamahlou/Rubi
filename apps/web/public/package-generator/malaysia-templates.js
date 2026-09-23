/* User-supplied Malaysia poster artwork, with live data regions supplied by the app. */
(function(){
const price=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const common={title:'مالزی',font:15,color:'#0929a0',columns:[29,9,11,10,10,15,16],
  headerBox:[216,278,786,49],adjustmentsDefault:'',
  servicesBox:[615,1311,305,103],adjustmentsBox:[269,1315,323,101]};
window.TEMPLATES['malaysia-kuala']={...common,label:'مالزی · کوالالامپور',style:'malaysia-kuala',width:1024,height:1536,
 image:window.MalaysiaAssets.kuala,body:[215,326,786,862],date:[229,200,222,46],durationBox:[487,129,326,54],
 titleBox:[491,35,270,102],rows:36,
 cardSlots:[price('commission','کمیسیون',221,1235,139,56),price('infant','نرخ نوزاد',375,1235,140,56),price('childFlight','نرخ پرواز کودک',682,1235,151,56),price('adult','نرخ پرواز بزرگسال',847,1235,151,56)]};
window.TEMPLATES['malaysia-penang']={...common,label:'مالزی · کوالالامپور + پنانگ',style:'malaysia-penang',width:1024,height:1536,
 image:window.MalaysiaAssets.penang,body:[215,326,786,776],date:[230,201,222,47],durationBox:[433,129,370,52],durationHole:[431,126,416,58],
 titleBox:[498,36,258,103],rows:23,servicesBox:[632,1257,294,129],adjustmentsBox:[279,1258,307,127],
 cardSlots:[price('commission','کمیسیون',220,1162,164,69),price('infant','نرخ نوزاد',394,1162,188,69),price('childFlight','نرخ پرواز کودک',595,1162,203,69),price('adult','نرخ پرواز بزرگسال',809,1162,184,69)]};
window.TEMPLATES['malaysia-singapore']={...common,label:'مالزی · کوالالامپور + سنگاپور',style:'malaysia-singapore',width:1122,height:1402,
 image:window.MalaysiaAssets.singapore,body:[239,313,864,710],date:[266,186,251,49],durationBox:[489,116,346,55],
 titleBox:[591,43,220,84],rows:29,servicesBox:[693,1154,302,113],adjustmentsBox:[317,1153,340,115],
 cardSlots:[price('commission','کمیسیون',244,1066,164,65),price('infant','نرخ نوزاد',413,1066,164,65),price('childFlight','نرخ پرواز کودک',586,1066,168,65),price('adult','نرخ پرواز بزرگسال',774,1066,155,65)]};
window.TEMPLATES['malaysia-langkawi']={...common,label:'مالزی · کوالالامپور + لنگکاوی',style:'malaysia-langkawi',width:1024,height:1536,
 image:window.MalaysiaAssets.langkawi,body:[208,328,794,792],date:[231,198,213,45],durationBox:[453,142,283,39],durationHole:[451,139,299,45],
 titleBox:[495,36,222,100],rows:25,servicesBox:[606,1294,319,79],adjustmentsBox:[257,1275,322,102],
 cardSlots:[price('commission','کمیسیون',210,1169,130,68),price('infant','نرخ نوزاد',365,1169,130,68),price('childFlight','نرخ پرواز کودک',527,1169,138,68),price('adult','نرخ پرواز بزرگسال',690,1169,147,68)]};
})();

const thailandTemplateSelect=document.getElementById('template');
if(thailandTemplateSelect){
  [['thailand-phuket','تایلند · پوکت'],['thailand-bangkok-phuket','تایلند · بانکوک + پوکت'],['thailand-pattaya','تایلند · پاتایا']].forEach(([value,label])=>thailandTemplateSelect.append(new Option(label,value)));
}

(function(){
  const slot=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
  const common={category:'tourism',externalImage:true,title:'پوکت',font:16,color:'#061a55',columns:[31,12,13,13,15,16],headerBox:[218,242,809,40],servicesBox:[220,1290,806,78],adjustmentsBox:[220,1158,806,121]};
  TEMPLATES['thailand-phuket']={...common,label:'تایلند · پوکت',style:'thailand-phuket',width:1060,height:1484,image:'thailand-phuket.png',body:[218,282,809,758],date:[247,183,194,43],titleBox:[454,55,285,92],durationBox:[530,150,248,43],rows:35,cardSlots:[slot('commission','کمیسیون همکار',229,1111,142,43),slot('flightDays','روزهای پرواز',410,1111,151,43),slot('departureTime','ساعت رفت',590,1111,119,43),slot('returnTime','ساعت برگشت',739,1111,118,43),slot('infant','نرخ نوزاد',883,1111,135,43)]};
  TEMPLATES['thailand-bangkok-phuket']={...common,label:'تایلند · بانکوک + پوکت',style:'thailand-bangkok-phuket',width:1055,height:1491,image:'thailand-bangkok-phuket.png',body:[214,280,803,724],headerBox:[214,240,803,40],date:[257,184,177,42],titleBox:[468,54,350,91],durationBox:[531,149,248,43],rows:20,servicesBox:[215,1278,801,88],adjustmentsBox:[215,1117,801,142],cardSlots:[slot('commission','کمیسیون همکار',228,1044,142,43),slot('infant','نرخ نوزاد',389,1044,142,43),slot('flightDays','روزهای پرواز',548,1044,185,43),slot('departureTime','ساعت رفت',749,1044,116,43),slot('returnTime','ساعت برگشت',880,1044,120,43)]};
  TEMPLATES['thailand-pattaya']={...common,label:'تایلند · پاتایا',style:'thailand-pattaya',width:1024,height:1536,image:'thailand-pattaya.png',body:[198,284,816,775],headerBox:[198,240,816,43],date:[238,173,194,43],titleBox:[434,50,288,96],durationBox:[511,148,251,43],rows:35,servicesBox:[198,1321,816,71],adjustmentsBox:[198,1168,816,141],cardSlots:[slot('commission','کمیسیون همکار',214,1085,175,50),slot('ticket','قیمت بلیط',402,1085,190,50),slot('childFlight','کودک زیر ۲ سال',605,1085,195,50),slot('adult','افزایش نرخ',813,1085,183,50)]};
})();
