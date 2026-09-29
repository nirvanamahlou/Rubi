(function(){
const slot=(key,label,x,y,w,h)=>({key,label,box:[x,y,w,h]});
const base={width:948,height:1659,font:16,color:'#071d5d',date:[186,361,224,77],columns:[26,10,16,16,16,16],
 servicesBox:[636,1298,300,189],notesBox:[170,1298,443,189],rows:5};
TEMPLATES['spain-barcelona']={...base,label:'اسپانیا · بارسلون',style:'spain-barcelona',title:'اسپانیا',image:SpainAssets.barcelona,
 body:[162,528,773,528],headerBox:[163,451,773,77],date:[245,336,162,59],titleBox:[431,157,273,103],durationBox:[406,271,319,67],durationHole:[400,265,330,80],noteIconBox:[174,1244,66,79],serviceIconBox:[861,1242,77,80],
 cardSlots:[slot('taxi','سیتی تاکس',177,1163,153,60),slot('infant','نوزاد زیر ۲ سال',364,1163,153,60),slot('stay','اقامت',553,1163,158,60),slot('departure','تاریخ حرکت',743,1163,178,60)],
 thumbnailBoxes:[[163,532,103,88],[163,627,103,99],[163,733,103,99],[163,841,103,99],[163,949,103,101]]};
TEMPLATES['spain-madrid']={...base,label:'اسپانیا · مادرید',style:'spain-madrid',title:'اسپانیا',image:SpainAssets.madrid,
 body:[177,508,759,554],headerBox:[177,432,759,75],date:[246,334,187,58],titleBox:[423,143,284,103],durationBox:[412,258,319,65],durationHole:[406,250,333,75],noteIconBox:[184,1245,65,79],serviceIconBox:[862,1243,76,81],
 cardSlots:[slot('taxi','سیتی تاکس',190,1168,150,59),slot('infant','نوزاد زیر ۲ سال',369,1168,159,59),slot('stay','اقامت',556,1168,158,59),slot('departure','تاریخ حرکت',743,1168,181,59)],
 thumbnailBoxes:[[177,510,104,94],[177,612,104,101],[177,720,104,106],[177,833,104,106],[177,950,104,106]]};
TEMPLATES['spain-combined']={...base,label:'ترکیبی · بارسلون + پاریس',style:'spain-combined',title:'تور ترکیبی اسپانیا و فرانسه',image:SpainAssets.combined,
 body:[155,568,782,372],headerBox:[155,490,782,77],date:[246,371,167,58],columns:[26,9,9,14,14,14,14],rows:3,
 titleBox:[391,157,333,118],durationBox:[390,284,320,82],durationHole:[385,278,330,92],servicesBox:[635,1198,300,247],notesBox:[160,1198,445,247],noteIconBox:[169,1137,67,80],serviceIconBox:[864,1134,75,83],
 cardSlots:[slot('taxi','سیتی تاکس',168,1062,159,60),slot('infant','نوزاد زیر ۲ سال',355,1062,159,60),slot('stay','اقامت',549,1062,168,60),slot('departure','تاریخ حرکت',746,1062,176,60)],
 thumbnailBoxes:[[155,569,101,102],[155,685,101,115],[155,815,101,116]]};
})();
