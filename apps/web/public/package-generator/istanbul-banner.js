'use strict';
// The supplied artwork stays untouched until an editor changes an individual field.
(() => {
 const white='#fff',navy='#082b69',sky='linear-gradient(115deg,#e9f7ff,#c9e9fc)';
 const slot=(rect,size,fill=white,extra={})=>({rect,size,fill,...extra});
 const hotel=(name,price,unit,stars)=>({
  name,price,unit,stars,service:'',photo:'',photoX:50,photoY:50
 });
 const cards=[
  {x:24,name:'Konak Hotel',price:'137',unit:'$',stars:'3'},
  {x:273,name:'Green Park Merter',price:'107',unit:'$',stars:'4'},
  {x:521,name:'Wish More Şişli',price:'182',unit:'€',stars:'5'},
  {x:769,name:'The Marmara Pera',price:'218',unit:'€',stars:'5'}
 ];
 BANNER_TEMPLATES.istanbul_promo={
  label:'استانبول · آفر ویژه و چهار هتل',category:'tourism',referenceLayout:true,
  preserveOriginalCards:true,width:1024,height:1536,capacity:4,
  primary:navy,accent:'#ff7b11',image:'istanbul-banner.png',
  logoBoxes:{agency:[36,22,202,176],airline:[791,12,189,193]},
  logos:{agency:'',airline:''},
  fields:{city:'استانبول',english:'Istanbul',offer:'آفر ویژه',tagline:'ترکیبی بی‌نظیر از تاریخ، فرهنگ و زندگی مدرن',date:'۷ مهر',airline:'تابان',flight:'48,900,000',flightUnit:'تومان',flightLabel:'نرخ پرواز',child:'49,900,000',childUnit:'تومان',outboundTime:'16:00',returnTime:'08:45',commission:'1,000,000',commissionUnit:'تومان',commissionLabel:'کمیسیون',phone:'021-72075000',address:'تهران، جردن، تقاطع میرداماد، کنارگذر مدرس، پلاک ۳۸۶، طبقه سوم',feature1:'رزرو آسان و مطمئن',feature2:'خدمات حرفه‌ای',feature3:'پشتیبانی سفر',feature4:'تجربه‌ای متفاوت'},
  slots:{
   english:slot([279,57,381,157],84,sky,{group:'title',italic:true,color:'#0753aa'}),
   city:slot([332,206,371,102],83,sky,{group:'title'}),
   offer:slot([742,240,251,143],73,'#ff7817',{color:white,radius:36,group:'title'}),
   tagline:slot([308,314,405,41],25,sky),
   date:slot([377,362,69,59],25,white),
   airline:slot([578,365,142,56],26,white),
   flight:slot([800,1074,200,66],29,white,{group:'price'}),
   child:slot([800,1147,200,65],29,white,{group:'price'}),
   outboundTime:slot([109,1190,138,47],28,white),
   returnTime:slot([295,1190,138,47],28,white),
   commission:slot([800,1219,200,66],29,white,{group:'price'}),
   phone:slot([89,1448,209,55],27,navy,{color:white,group:'footer'}),
   address:slot([356,1450,455,49],19,navy,{color:white,group:'footer'}),
   feature1:slot([53,1333,171,44],18,white,{group:'footer'}),
   feature2:slot([274,1333,157,44],18,white,{group:'footer'}),
   feature3:slot([469,1333,163,44],18,white,{group:'footer'}),
   feature4:slot([666,1333,171,44],18,white,{group:'footer'})
  },
  cards:cards.map(({x})=>({frame:[x,609,232,444],photo:[x+3,612,226,251],name:[x+7,865,218,33],service:[x+7,896,218,26],price:[x+9,923,214,55],nameFill:white,nameColor:navy,priceColor:white,priceFill:'linear-gradient(90deg,#0754a6,#002d75)',emptyFill:white,noSamplePhoto:true})),
  hotels:cards.map(({name,price,unit,stars})=>hotel(name,price,unit,stars))
 };
})();
