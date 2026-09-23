/* User-supplied corrected Malaysia and Thailand poster artwork. */
(function(){
const price=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const malaysia={externalImage:true,title:'مالزی',color:'#0929a0',columns:[29,9,11,10,10,15,16],adjustmentsDefault:''};
window.TEMPLATES['malaysia-kuala']={...malaysia,label:'مالزی · کوالالامپور',style:'malaysia-kuala',width:854,height:1280,
 image:'malaysia-kuala.jpg',font:12,headerBox:[183,239,650,35],body:[183,274,650,696],date:[189,165,191,46],durationBox:[418,87,332,51],
 titleBox:[454,25,213,81],rows:36,servicesBox:[499,1071,334,117],adjustmentsBox:[183,1071,310,117],
 cardSlots:[price('commission','کمیسیون',187,1005,134,53),price('infant','نرخ نوزاد',333,1005,157,53),price('childFlight','نرخ پرواز کودک',502,1005,161,53),price('adult','نرخ پرواز بزرگسال',675,1005,154,53)]};
window.TEMPLATES['malaysia-penang']={...malaysia,label:'مالزی · کوالالامپور + پنانگ',style:'malaysia-penang',width:1024,height:1280,
 image:'malaysia-penang.jpg',font:12,headerBox:[197,233,791,38],body:[197,271,791,699],date:[201,163,192,46],durationBox:[428,66,365,57],durationHole:[425,64,372,61],
 titleBox:[487,24,227,82],rows:31,servicesBox:[544,1071,440,114],adjustmentsBox:[199,1071,338,114],
 cardSlots:[price('commission','کمیسیون',202,1006,137,52),price('infant','نرخ نوزاد',353,1006,166,52),price('childFlight','نرخ پرواز کودک',534,1006,192,52),price('adult','نرخ پرواز بزرگسال',741,1006,239,52)]};
window.TEMPLATES['malaysia-singapore']={...malaysia,label:'مالزی · کوالالامپور + سنگاپور',style:'malaysia-singapore',width:960,height:1280,
 image:'malaysia-singapore.jpg',font:12,headerBox:[202,235,738,38],body:[202,273,738,696],date:[211,164,204,45],durationBox:[438,77,350,50],
 titleBox:[477,25,220,82],rows:31,servicesBox:[568,1070,371,118],adjustmentsBox:[204,1070,357,118],
 cardSlots:[price('commission','کمیسیون',207,1005,145,53),price('infant','نرخ نوزاد',366,1005,169,53),price('childFlight','نرخ پرواز کودک',549,1005,190,53),price('adult','نرخ پرواز بزرگسال',753,1005,182,53)]};
window.TEMPLATES['malaysia-langkawi']={...malaysia,label:'مالزی · کوالالامپور + لنگکاوی',style:'malaysia-langkawi',width:720,height:1080,
 image:'malaysia-langkawi.jpg',font:10,headerBox:[153,202,552,32],body:[153,234,552,558],date:[154,135,136,38],durationBox:[313,78,249,41],durationHole:[310,76,255,45],
 titleBox:[349,23,175,69],rows:28,servicesBox:[423,878,283,127],adjustmentsBox:[154,878,264,127],
 cardSlots:[price('commission','کمیسیون',157,821,120,46),price('infant','نرخ نوزاد',289,821,122,46),price('childFlight','نرخ پرواز کودک',423,821,132,46),price('adult','نرخ پرواز بزرگسال',567,821,135,46)]};
})();

const thailandTemplateSelect=document.getElementById('template');
if(thailandTemplateSelect){
  [['thailand-phuket','تایلند · پوکت'],['thailand-bangkok-phuket','تایلند · بانکوک + پوکت'],['thailand-pattaya','تایلند · پاتایا']].forEach(([value,label])=>thailandTemplateSelect.append(new Option(label,value)));
}

(function(){
const slot=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const thailand={category:'tourism',externalImage:true,color:'#061a55',columns:[31,12,13,13,15,16]};
TEMPLATES['thailand-phuket']={...thailand,label:'تایلند · پوکت',style:'thailand-phuket',title:'پوکت',width:771,height:1080,image:'thailand-phuket.jpg',font:10,
 headerBox:[159,165,595,30],body:[159,195,595,499],date:[160,114,151,39],titleBox:[325,20,220,84],durationBox:[344,79,230,42],rows:35,
 servicesBox:[162,872,590,129],adjustmentsBox:[162,785,590,80],
 cardSlots:[slot('commission','کمیسیون همکار',165,724,108,50),slot('flightDays','روزهای پرواز',287,724,114,50),slot('departureTime','ساعت رفت',415,724,100,50),slot('returnTime','ساعت برگشت',528,724,97,50),slot('infant','نرخ نوزاد',639,724,109,50)]};
TEMPLATES['thailand-bangkok-phuket']={...thailand,label:'تایلند · بانکوک + پوکت',style:'thailand-bangkok-phuket',title:'بانکوک + پوکت',width:764,height:1080,image:'thailand-bangkok-phuket.jpg',font:10,
 headerBox:[153,171,586,29],body:[153,200,586,531],date:[153,113,163,39],titleBox:[324,20,264,84],durationBox:[349,80,251,40],rows:24,
 servicesBox:[153,906,586,96],adjustmentsBox:[153,816,586,85],
 cardSlots:[slot('commission','کمیسیون همکار',158,763,107,44),slot('infant','نرخ نوزاد',278,763,108,44),slot('flightDays','روزهای پرواز',399,763,112,44),slot('departureTime','ساعت رفت',524,763,96,44),slot('returnTime','ساعت برگشت',634,763,101,44)]};
TEMPLATES['thailand-pattaya']={...thailand,label:'تایلند · پاتایا',style:'thailand-pattaya',title:'پاتایا',width:720,height:1080,image:'thailand-pattaya.jpg',font:9,
 headerBox:[140,167,565,28],body:[140,195,565,593],date:[142,104,146,37],titleBox:[318,16,230,88],durationBox:[317,78,286,41],rows:35,
 servicesBox:[141,958,563,63],adjustmentsBox:[141,871,563,82],
 cardSlots:[slot('commission','کمیسیون همکار',145,819,127,43),slot('ticket','قیمت بلیط',285,819,128,43),slot('childFlight','کودک زیر ۲ سال',426,819,128,43),slot('adult','افزایش نرخ',567,819,133,43)]};
})();
