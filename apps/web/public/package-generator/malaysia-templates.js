/* User-supplied corrected Malaysia and Thailand poster artwork. */
(function(){
const price=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const malaysia={externalImage:true,fixedCardSlots:true,title:'مالزی',color:'#0929a0',columns:[29,9,11,10,10,15,16],adjustmentsDefault:''};
window.TEMPLATES['malaysia-kuala']={...malaysia,label:'مالزی · کوالالامپور',style:'malaysia-kuala',width:854,height:1280,
 image:'malaysia-kuala.jpg',font:12,headerBox:[183,239,650,35],body:[183,274,650,696],date:[189,165,191,46],durationBox:[385,99,330,51],
 titleBox:[454,25,213,81],rows:36,servicesBox:[499,1071,334,117],adjustmentsBox:[183,1071,310,117],
 cardSlots:[price('commission','کمیسیون',187,1005,134,53),price('infant','نرخ نوزاد',333,1005,157,53),price('childFlight','نرخ پرواز کودک',502,1005,161,53),price('adult','نرخ پرواز بزرگسال',675,1005,154,53)]};
window.TEMPLATES['malaysia-penang']={...malaysia,label:'مالزی · کوالالامپور + پنانگ',style:'malaysia-penang',width:1024,height:1280,
 image:'malaysia-penang.jpg',font:12,headerBox:[197,233,791,38],body:[197,271,791,699],date:[201,163,192,46],durationBox:[400,103,310,48],durationHole:[397,100,316,53],
 titleBox:[487,24,227,82],rows:31,servicesBox:[544,1071,440,114],adjustmentsBox:[199,1071,338,114],
 cardSlots:[price('commission','کمیسیون',202,1006,137,52),price('infant','نرخ نوزاد',353,1006,166,52),price('childFlight','نرخ پرواز کودک',534,1006,192,52),price('adult','نرخ پرواز بزرگسال',741,1006,239,52)]};
window.TEMPLATES['malaysia-singapore']={...malaysia,label:'مالزی · کوالالامپور + سنگاپور',style:'malaysia-singapore',width:960,height:1280,
 image:'malaysia-singapore.jpg',font:12,headerBox:[202,235,738,38],body:[202,273,738,696],date:[211,164,204,45],durationBox:[400,100,360,48],
 titleBox:[477,25,220,82],rows:31,servicesBox:[568,1070,371,118],adjustmentsBox:[204,1070,357,118],
 cardSlots:[price('commission','کمیسیون',207,1005,145,53),price('infant','نرخ نوزاد',366,1005,169,53),price('childFlight','نرخ پرواز کودک',549,1005,190,53),price('adult','نرخ پرواز بزرگسال',753,1005,182,53)]};
window.TEMPLATES['malaysia-langkawi']={...malaysia,label:'مالزی · کوالالامپور + لنگکاوی',style:'malaysia-langkawi',width:720,height:1080,
 image:'malaysia-langkawi.jpg',font:10,headerBox:[153,202,552,32],body:[153,234,552,558],date:[154,135,136,38],durationBox:[300,91,280,44],durationHole:[297,88,286,49],
 titleBox:[349,23,175,69],rows:28,servicesBox:[423,878,283,127],adjustmentsBox:[154,878,264,127],
 cardSlots:[price('commission','کمیسیون',157,821,120,46),price('infant','نرخ نوزاد',289,821,122,46),price('childFlight','نرخ پرواز کودک',423,821,132,46),price('adult','نرخ پرواز بزرگسال',567,821,135,46)]};
})();

const thailandTemplateSelect=document.getElementById('template');
if(thailandTemplateSelect){
  [['thailand-phuket','تایلند · پوکت'],['thailand-bangkok-phuket','تایلند · بانکوک + پوکت'],['thailand-pattaya','تایلند · پاتایا']].forEach(([value,label])=>thailandTemplateSelect.append(new Option(label,value)));
}

(function(){
const slot=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const thailand={category:'tourism',externalImage:true,fixedCardSlots:true,color:'#061a55',columns:[31,12,13,13,15,16]};
TEMPLATES['thailand-phuket']={...thailand,label:'تایلند · پوکت',style:'thailand-phuket',title:'پوکت',width:771,height:1080,image:'thailand-phuket.jpg',font:10,
 headerBox:[168,176,570,28],body:[168,204,570,568],date:[184,131,132,33],titleBox:[325,20,220,84],durationBox:[335,117,205,43],rows:35,minFont:7,
 servicesBox:[185,951,475,39],adjustmentsBox:[160,852,592,83],rateCount:7,
 cardSlots:[slot('commission','کمیسیون همکار',164,806,123,37),slot('flightDays','روزهای پرواز',292,806,122,37),slot('departureTime','ساعت رفت',420,806,103,37),slot('returnTime','ساعت برگشت',530,806,107,37),slot('infant','نرخ نوزاد',642,806,103,37)]};
TEMPLATES['thailand-bangkok-phuket']={...thailand,label:'تایلند · بانکوک + پوکت',style:'thailand-bangkok-phuket',title:'بانکوک + پوکت',width:764,height:1080,image:'thailand-bangkok-phuket.jpg',font:10,
 headerBox:[167,176,565,28],body:[167,204,565,528],date:[181,132,133,33],titleBox:[324,20,264,84],durationBox:[350,119,205,43],rows:24,minFont:7,
 servicesBox:[180,938,470,48],adjustmentsBox:[154,816,585,103],rateCount:8,
 cardSlots:[slot('commission','کمیسیون همکار',158,763,109,44),slot('infant','نرخ نوزاد',270,763,104,44),slot('flightDays','روزهای پرواز',377,763,138,44),slot('departureTime','ساعت رفت',517,763,106,44),slot('returnTime','ساعت برگشت',626,763,109,44)]};
TEMPLATES['thailand-pattaya']={...thailand,label:'تایلند · پاتایا',style:'thailand-pattaya',title:'پاتایا',width:720,height:1080,image:'thailand-pattaya.jpg',font:9,
 headerBox:[144,170,557,27],headerBoxes:[[144,170,278,27],[424,170,277,27]],body:[144,197,557,590],bodyColumns:[[144,197,278,590],[424,197,277,590]],tableColumns:2,minFont:6.5,date:[167,125,121,34],titleBox:[318,16,230,88],durationBox:[325,115,180,43],rows:35,
 servicesBox:[187,961,447,42],adjustmentsBox:[142,874,557,76],
 cardSlots:[slot('commission','کمیسیون همکار',145,816,127,47),slot('ticket','قیمت بلیط',279,816,137,47),slot('childFlight','کودک زیر ۲ سال',424,816,138,47),slot('adult','افزایش نرخ',573,816,128,47)]};
})();
