'use strict';

// All rectangles use the original supplied artwork's pixel coordinates.
window.PackageGalleryTemplates = (() => {
  const field = (id, label, text, box, size = 30, options = {}) => ({
    id, label, text, box, size, color: '#07276b', background: '#fff', radius: 5,
    align: 'center', ...options,
  });
  const photo = (id, label, box, radius = 14) => ({ id, label, box, radius, kind: 'image' });
  const price = (id, text, box, options = {}) => field(id, 'قیمت ' + id.replace('price-', ''), text, box, 38,
    { color: '#fff', background: 'linear-gradient(110deg,#1e5d91,#003263)', radius: 13, ...options });
  const contact = (phone, social, web, address) => [
    ...(phone ? [field('phone', 'تلفن', '021-72075000', phone, 30, { ltr: true })] : []),
    ...(social ? [field('social', 'شبکه اجتماعی', '@jahanbastan.co', social, 27, { ltr: true })] : []),
    ...(web ? [field('website', 'وب‌سایت', 'jahanbastan.ir', web, 27, { ltr: true })] : []),
    ...(address ? [field('address', 'آدرس', 'تهران، جردن، تقاطع میرداماد، کنار گذر مدرس، پلاک ۳۸۶، طبقه سوم', address, 20)] : []),
  ];
  const domestic = (city, duration, columns, rowY) => {
    const result = [field('city', 'مقصد', city, [330, 38, 464, 223], 130),
      field('duration', 'مدت سفر', duration, city === 'قشم' ? [487, 235, 174, 88] : [450, 272, 214, 40], 38,
        { color: city === 'قشم' ? '#08266a' : '#fff', background: city === 'قشم' ? '#e8f4ff' : '#05366b' }),
      field('season', 'تاریخ / مناسبت', 'ویژه مهرماه', [431, 335, 219, 48], 38, { background: '#e8c589' })];
    columns.forEach((hotel, index) => {
      const x = [47, 400, 743][index % 3], y = rowY[Math.floor(index / 3)];
      result.push(field('hotel-' + index, 'نام هتل ' + (index + 1), hotel[0], [x + 4, y, 320, 44], 33, { background: '#e9f5ff' }));
      if (hotel[2]) result.push(field('stars-' + index, 'درجه هتل ' + (index + 1), hotel[2] + ' ★', [x + 30, y + 47, 265, 30], 27, { color: '#b97809', background: '#e9f5ff' }));
      const photoY = y + (hotel[2] ? 80 : 50);
      result.push(photo('photo-' + index, 'عکس هتل ' + (index + 1), [x, photoY, 332, 190]),
        price('price-' + (index + 1), hotel[1] + '\nتومان', [x, photoY + 193, 332, 72]));
    });
    result.push(...contact([95, 1301, 183, 34], [376, 1301, 165, 34], [622, 1301, 184, 34]),
      photo('agency', 'لوگوی آژانس', [44, 29, 210, 212]),
      field('feature-flight', 'خدمت پرواز', 'بلیط رفت و برگشت', [130, 451, 161, 40], 26),
      field('feature-transfer', 'خدمت ترانسفر', 'استقبال فرودگاهی', [398, 451, 145, 40], 26),
      field('feature-stay', 'خدمت اقامت', 'اقامت در هتل با صبحانه', [657, 451, 164, 40], 24),
      field('feature-discount', 'خدمت گردشگری', 'تخفیفات گردشگری', [924, 451, 138, 40], 25));
    return result;
  };
  const templates = {
    'package-kish': { country: 'iran', label: 'کیش · شش هتل', width: 1122, height: 1402, image: 'assets/package-kish.png', fields:
      domestic('کیش', '۲ شب و ۳ روز', [['هتل هلیا', '۱۸.۵۰۰.۰۰۰', '۳'], ['هتل پارمیدا', '۱۸.۹۰۰.۰۰۰', '۴'], ['هتل امیرکبیر', '۱۹.۲۰۰.۰۰۰', '۵'], ['هتل بین المللی', '۱۹.۹۰۰.۰۰۰', '۵'], ['هتل پالاس', '۲۳.۲۰۰.۰۰۰', '۵'], ['هتل ترنج', '۲۶.۹۰۰.۰۰۰', '۵']], [522, 883]) },
    'package-qeshm': { country: 'iran', label: 'قشم · شش هتل', width: 1122, height: 1402, image: 'assets/package-qeshm.png', fields: [
      ...domestic('قشم', '۳ شب\n۴ روز', [['هتل کیمیا', '۲۶.۹۰۰.۰۰۰'], ['هتل بهشت', '۲۷.۵۰۰.۰۰۰'], ['هتل پرشین گلف', '۲۷.۹۰۰.۰۰۰'], ['هتل آرتا', '۲۹.۹۰۰.۰۰۰'], ['هتل بوتیک ایرمان', '۳۲.۹۰۰.۰۰۰'], ['هتل آراکتا', '۳۹.۹۰۰.۰۰۰']], [541, 891])
        .filter(f => !['phone', 'social', 'website'].includes(f.id)),
      ...contact([56, 1320, 178, 39], [302, 1320, 172, 39], [531, 1320, 205, 39], [790, 1314, 314, 53]),
      photo('airline', 'لوگوی ایرلاین', [43, 292, 214, 119]) ] },
    'package-mashhad': { country: 'iran', label: 'مشهد · نرخ دو و سه شب', width: 960, height: 1280, image: 'assets/package-mashhad.jpg', fields: [
      field('city', 'مقصد', 'مشهد', [234, 188, 373, 151], 115), field('tour', 'تیتر تور', 'تور', [482, 99, 109, 81], 66, { color: '#aa7d16' }),
      field('duration', 'مدت سفر', '۲ شب و ۳ شب', [318, 362, 247, 46], 38, { background: '#d8efff' }),
      field('season', 'تاریخ / مناسبت', 'ویژه مهرماه', [329, 421, 223, 44], 35, { background: '#eed49c' }),
      field('tagline', 'شعار', 'سفری فراتر از مرزها\nبا جهان باستان', [40, 256, 191, 61], 24, { color: '#888' }),
      photo('agency', 'لوگوی آژانس', [38, 29, 207, 183]), photo('hero', 'عکس مقصد', [623, 52, 309, 426], 55),
      ...['هتل قصر طلایی', 'هتل الماس ۲', 'هتل کیانا', 'هتل انقلاب'].flatMap((name, index) => {
        const x = [34, 264, 482, 714][index]; return [field('hotel-' + index, 'نام هتل ' + (index + 1), name, [x, 599, 205, 38], 30, { background: '#edf8ff' }),
          photo('photo-' + index, 'عکس هتل ' + (index + 1), [x, 642, 205, 162]),
          price('price-two-' + index, ['۲۸.۵۰۰.۰۰۰', '۲۷.۵۰۰.۰۰۰', '۲۵.۵۰۰.۰۰۰', '۲۳.۵۰۰.۰۰۰'][index], [x, 842, 205, 31], { size: 30, color: '#062c64', background: '#efdba9', radius: 0 }),
          price('price-three-' + index, ['۳۳.۵۰۰.۰۰۰', '۳۱.۵۰۰.۰۰۰', '۲۷.۵۰۰.۰۰۰', '۲۵.۵۰۰.۰۰۰'][index], [x, 913, 205, 32], { size: 30, radius: 0 }),
          field('stay-two-' + index, 'عنوان نرخ اول ' + (index + 1), '۲ شب', [x, 811, 205, 28], 25, { background: '#efdba9' }),
          field('stay-three-' + index, 'عنوان نرخ دوم ' + (index + 1), '۳ شب', [x, 881, 205, 29], 25, { color: '#fff', background: '#09376c' })];
      }), ...contact([80, 1147, 169, 33], [317, 1147, 137, 33], [535, 1147, 141, 33]),
      field('flight-info', 'متن پرواز', 'با بهترین ایرلاین‌ها،\nآسان‌تر به مشهد سفر کنید', [385, 1008, 183, 77], 27, { background: '#e7f5ff' }),
      field('feature-flight', 'خدمات پرواز', 'پرواز رفت و برگشت', [143, 515, 176, 39], 28),
      field('feature-transfer', 'خدمات ترانسفر', 'استقبال فرودگاهی', [443, 515, 171, 39], 28),
      field('feature-airline', 'خدمات ایرلاین', 'ایرلاین‌های معتبر', [741, 515, 171, 39], 28) ] },
    'package-vietnam': { country: 'vietnam', label: 'ویتنام · پکیج ترکیبی', width: 1122, height: 1402, image: 'assets/package-vietnam.png', fields: [
      field('city', 'مقصد', 'ویتنام', [535, 10, 292, 130], 108),
      field('route', 'مسیر سفر', 'سایگون (هوشی‌مین) + دانانگ + هانوی + خلیج هالونگ', [443, 144, 633, 37], 31),
      field('stays', 'تقسیم اقامت', '۲ شب          ۲ شب          ۲ شب          ۱ شب', [458, 188, 419, 23], 24),
      field('duration', 'مدت سفر', '۷ شب و ۸ روز', [435, 217, 211, 39], 32, { color: '#fff', background: '#052f67' }),
      field('date', 'تاریخ سفر', 'ویژه مهر و آبان', [674, 219, 196, 32], 30), field('flight', 'پرواز', 'پرواز با ماهان', [952, 218, 139, 33], 30),
      photo('agency', 'لوگوی آژانس', [254, 8, 173, 172]), photo('airline', 'لوگوی ایرلاین', [857, 14, 245, 107]),
      ...['هتل', 'شهر', 'خدمات', 'دو تخته', 'یک تخته', 'کودک با تخت', 'کودک بدون تخت'].map((text, index) => field('column-' + index, 'عنوان ستون ' + (index + 1), text, [[237, 276, 224, 40], [466, 276, 96, 40], [566, 276, 74, 40], [643, 276, 91, 40], [738, 276, 95, 40], [836, 276, 114, 40], [954, 276, 139, 40]][index], 24, { color: '#fff', background: '#063066' })),
      ...['SKY GEM SORA HOTEL\nOR SIMILAR', 'CICILIA DANANG HOTELS & SPA\nOR SIMILAR', 'LESTAR HOTEL OR SIMILAR', 'AMANDA LUXURY LAN HA\nOR SIMILAR', 'HOTEL EQUATORIAL OR SIMILAR', 'KOI RESORT AND SPA OR SIMILAR', 'HOTEL NOVOTEL THAI HA\nOR SIMILAR', 'AQUA OF THE SEAS OR SIMILAR', 'PULLMAN SAIGON OR SIMILAR', 'KOI RESORT & RESIDENCE\nOR SIMILAR', 'L7 WESTLAKE HANOI BY LOTTE\nOR SIMILAR', 'CAPELLA CRUISE OR SIMILAR'].flatMap((name, index) => {
        const y = [322, 371, 418, 460, 509, 553, 592, 642, 687, 732, 775, 824][index], h = [43, 43, 38, 40, 40, 38, 45, 37, 39, 40, 43, 34][index], background = index >= 4 && index < 8 ? '#fbf3df' : '#e1effc';
        return [field('hotel-' + index, 'نام هتل ' + (index + 1), name, [239, y, 220, h], 20, { ltr: true, align: 'left', background }),
          field('hotel-city-' + index, 'شهر هتل ' + (index + 1), ['HOCHIMINH', 'DANANG', 'HANOI', 'HALONG'][index % 4], [468, y, 93, h], 18, { ltr: true, background }),
          field('hotel-service-' + index, 'خدمات هتل ' + (index + 1), (index < 4 ? '4*' : '5*') + (index % 4 === 3 ? 'FB' : 'BB'), [568, y, 71, h], 22, { ltr: true, background })];
      }),
      ...[[935, 1210, 720, 460], [1120, 1540, 850, 550], [1240, 1890, 960, 620]].flatMap((rates, index) => rates.map((value, column) => field('rate-' + index + '-' + column, 'نرخ گروه ' + (index + 1) + ' / ' + ['دو تخته', 'یک تخته', 'کودک با تخت', 'کودک بدون تخت'][column], value.toLocaleString('en-US') + ' $', [[646, 329, 86, 167], [740, 329, 91, 167], [837, 329, 112, 167], [956, 329, 135, 167]][column].map((v, j) => j === 1 ? v + index * 179 : v), 24, { ltr: true, background: index === 1 ? '#fbf3df' : '#e1effc' }))),
      field('services', 'خدمات تور', 'پرواز رفت به هوشی‌مین و برگشت از هانوی با هواپیمایی ماهان، اقامت ۷ شب و ۸ روز در هتل، ترانسفرهای فرودگاهی، راهنمای محلی، پرواز داخلی، ویزا، بیمه مسافرتی', [249, 908, 827, 128], 25),
      field('notes', 'توضیحات و شرایط', 'نرخ کودک زیر ۲ سال: ۲۰۰ دلار + هزینه پرواز.\nپرداخت مبلغ ریالی + ۵۰٪ مبلغ دلاری هنگام ثبت نام الزامی است.\nمسئولیت کنترل پاسپورت و ممنوعیت خروج بر عهده مسافر است.', [249, 1091, 827, 83], 23),
      field('infant', 'نرخ کودک زیر دو سال', '۳۰۰ دلار\n+ هزینه پرواز', [498, 1230, 154, 60], 31),
      field('child-flight', 'نرخ پرواز کودک', '100.000.000\nتومان', [695, 1232, 174, 57], 30),
      field('adult-flight', 'نرخ پرواز بزرگسال', '115.000.000\nتومان', [915, 1232, 175, 57], 30),
      ...contact([114, 1337, 231, 49], null, null, [440, 1340, 650, 43]).map(f => ({ ...f, color: '#fff', background: '#07366e' })) ] },
  };
  const wide = (id, country, label, width, height, image, fields) => ({ country, label, width, height, image, fields });
  templates['package-vietnam-luxury'] = wide('luxury', 'vietnam', 'ویتنام · لاکچری دوصفحه‌ای', 1492, 1054, 'assets/package-vietnam-luxury.png', [
    field('city', 'مقصد', 'ویتنام', [12, 139, 302, 112], 105),
    field('route', 'مسیر و اقامت', '۳ شب هوشی‌مین | ۳ شب دانانگ | ۲ شب هانوی | ۱ شب خلیج هالونگ (کروز)', [26, 265, 691, 34], 24),
    field('date', 'تاریخ', 'ویژه ۱۵ آذر', [65, 306, 143, 49], 28),
    field('flight', 'پرواز', 'پرواز با ماهان ایر', [276, 311, 147, 43], 24),
    field('duration', 'مدت', '۹ شب و ۱۰ روز', [487, 313, 225, 39], 25),
    field('headline', 'عنوان صفحه دوم', 'سفری به سرزمین شگفتی‌ها و لبخندهای ویتنام', [811, 58, 602, 44], 32),
    field('subtitle', 'مسیر صفحه دوم', 'هوشی‌مین، دانانگ، هانوی و خلیج هالونگ', [852, 108, 511, 30], 28),
    field('stays', 'تقسیم اقامت صفحه دوم', '۳ شب هوشی‌مین | ۳ شب دانانگ | ۲ شب هانوی | ۱ شب خلیج هالونگ (کروز)', [791, 144, 664, 30], 22),
    field('visa-service', 'خدمات ویزا', 'خدمات اخذ ویزای ویتنام همراه با پرداخت ورودی سفارت', [427, 377, 283, 30], 16, { background: '#ecf8ff' }),
    field('fast-service', 'خدمات فرودگاه', 'خدمات فست ترک فرودگاه هوشی‌مین', [87, 377, 275, 30], 17, { background: '#ecf8ff' }),
    ...[['outbound', 390, 'پرواز رفت', ['شماره پرواز', 'تاریخ', 'پرواز از تهران', 'ورود به هوشی‌مین']], ['inbound', 26, 'پرواز برگشت', ['شماره پرواز', 'تاریخ', 'پرواز از هانوی', 'ورود به تهران']]].flatMap(([key, x, title, labels]) => [
      field(key + '-title', title, title, [x + 59, 439, 224, 39], 35, { color: '#fff', background: '#075fa4' }),
      ...labels.map((text, index) => field(key + '-label-' + index, 'عنوان ' + title + ' ' + (index + 1), text, [x + 206, 494 + index * 32, 117, 26], 19, { background: '#f1faff' })),
      ...labels.map((text, index) => field(key + '-value-' + index, text + ' (' + title + ')', '', [x + 63, 494 + index * 32, 125, 26], 20, { background: '#f1faff' })),
      field(key + '-duration', 'مدت ' + title, key === 'outbound' ? '۷ ساعت و ۴۹ دقیقه' : '۷ ساعت و ۵۵ دقیقه', [x + 75, 625, 217, 28], 24, { background: '#eaf8ff' })]),
    ...['NEW WORLD SAIGON', 'DANANG MARRIOTT RESORT', 'FAIRMONT HANOI', 'INDOCHINA CRUISE'].flatMap((text, index) => [
      field('hotel-' + index, 'هتل ' + (index + 1), text, [240, 735 + index * 28, 228, 24], 18, { ltr: true, background: '#e6f5ff' }),
      field('hotel-city-' + index, 'شهر هتل ' + (index + 1), ['هوشی‌مین', 'دانانگ', 'هانوی', 'هالونگ'][index], [473, 735 + index * 28, 127, 24], 20, { background: '#e6f5ff' }),
      field('hotel-room-' + index, 'اتاق هتل ' + (index + 1), 'STANDARD', [107, 735 + index * 28, 126, 24], 17, { ltr: true, background: '#e6f5ff' }),
      field('hotel-stars-' + index, 'درجه هتل ' + (index + 1), '5 ★', [24, 735 + index * 28, 77, 24], 20, { background: '#e6f5ff' }),
      photo('hotel-photo-' + index, 'عکس هتل ' + (index + 1), [606, 733 + index * 28, 114, 26], 3)]),
    ...['کودک بدون تخت', 'کودک با تخت', 'نفر سوم (تخت اضافه)', 'یک تخته', 'دو تخته'].flatMap((text, index) => [
      field('rate-label-' + index, 'عنوان نرخ ' + (index + 1), text, [25 + index * 141, 883, 132, 30], 19, { color: '#fff', background: '#007b77' }),
      field('rate-dollar-' + index, 'نرخ دلاری ' + text, 'دلار', [25 + index * 141, 921, 132, 32], 24, { background: '#f0f1f1' }),
      field('rate-toman-' + index, 'نرخ تومانی ' + text, 'تومان', [25 + index * 141, 961, 132, 30], 24, { background: '#f0f1f1' })]),
    ...['خلیج هالونگ', 'هانوی', 'دانانگ', 'هوشی‌مین'].flatMap((city, index) => [
      photo('city-photo-' + index, 'عکس ' + city, [764 + index * 175, 179, 158, 157], 12),
      field('city-caption-' + index, 'عنوان ' + city, city, [767 + index * 175, 340, 151, 24], 21),
      field('city-description-' + index, 'معرفی ' + city, ['طبیعت بی‌نظیر و کروز روی آب', 'شهر تاریخ و فرهنگ غنی', 'ترکیبی از طبیعت و آرامش', 'شهری پویا و مدرن'][index], [767 + index * 175, 371, 151, 21], 16)]),
    field('services', 'خدمات تور', 'ویزای ویتنام، خدمات فست ترک، ورودی جاذبه‌های توریستی، گشت و ترانسفر، راهنمای فارسی‌زبان، پرواز داخلی، اقامت و وعده‌های غذایی، بیمه مسافرتی', [774, 453, 688, 184], 27, { background: '#edf8ff' }),
    field('travel-summary', 'خلاصه سفر', 'مقصد: ویتنام\nمسیر: هوشی‌مین، دانانگ، هانوی، خلیج هالونگ\nمدت: ۹ شب و ۱۰ روز\nتاریخ:\nایرلاین: ماهان ایر\nنوع تور: گروهی', [814, 711, 275, 181], 24),
    field('notes', 'نکات مهم', 'نرخ کودک زیر ۲ سال: تماس بگیرید.\nپرداخت مبلغ ریالی + ۵۰٪ مبلغ دلاری هنگام ثبت نام الزامی است.\nامکان جابه‌جایی برنامه گشت‌ها وجود دارد.\nمیزان بار مجاز در پرواز داخلی ۲۰ کیلوگرم است.\nمسئولیت کنترل پاسپورت و ممنوعیت خروج بر عهده مسافر است.', [1130, 708, 326, 177], 23),
    field('reminder', 'یادداشت', 'پرداخت کلیه ورودی‌های جاذبه‌های توریستی طبق برنامه سفر انجام می‌شود.', [866, 917, 549, 29], 22),
    ...contact([58, 1019, 119, 26], [249, 1019, 150, 26], [469, 1019, 245, 26], [819, 1019, 501, 26]).map(f => ({ ...f, color: '#fff', background: '#064484', size: 19 })),
    photo('agency', 'لوگوی آژانس', [20, 8, 114, 104]), photo('airline', 'لوگوی ایرلاین', [599, 0, 143, 139]) ]);
  templates['package-china'] = wide('china', 'china', 'چین · تور چهار شهر', 1484, 1060, 'assets/package-china.png', [
    field('city', 'مقصد', 'چین', [15, 187, 277, 108], 112), field('tour', 'نوع تور', 'تور ۴ شهره', [30, 301, 247, 44], 40),
    field('route', 'مسیر', 'شانگهای + ژانگ جیاجی + چنگدو + پکن', [28, 350, 301, 29], 24),
    field('date', 'تاریخ', 'ویژه ۲۱ آبان', [71, 400, 127, 30], 27), field('flight', 'پرواز', 'پرواز با ماهان ایر', [269, 400, 140, 30], 23),
    field('duration', 'مدت', '۱۰ شب و ۱۱ روز', [480, 400, 129, 30], 23),
    photo('agency', 'لوگوی آژانس', [28, 10, 144, 126]), photo('airline', 'لوگوی ایرلاین', [570, 8, 143, 125]),
    field('headline', 'عنوان صفحه دوم', 'سفری به سرزمین شگفتی‌ها و خاطره‌های ماندگار', [853, 98, 450, 30], 29),
    field('subtitle', 'زیرعنوان صفحه دوم', 'شانگهای، ژانگ جیاجی، چنگدو و پکن؛ سفری متفاوت به قلب چین', [808, 135, 609, 27], 24),
    ...['SHANGHAI STADIUM\nRADISSON BLU', 'HOWARD JOHNSON\nNEODALLE RESORT ZHANGJIAJIE', 'KEMPINSKI HOTEL\nCHENGDU', 'CROWNE PLAZA\nBEIJING LIDO'].flatMap((text, index) => [
      field('hotel-' + index, 'نام هتل ' + (index + 1), text, [183, 477 + index * 47, 358, 40], 19, { ltr: true, align: 'left', background: '#eaf6ff' }),
      field('hotel-service-' + index, 'درجه و خدمات هتل ' + (index + 1), '5*BB', [42, 478 + index * 47, 120, 37], 27, { ltr: true, background: '#eaf6ff' }),
      photo('hotel-photo-' + index, 'عکس هتل ' + (index + 1), [551, 477 + index * 47, 147, 41], 6)]),
    ...[['کودک بدون تخت', '1,450 $'], ['کودک با تخت', '2,050 $'], ['یک تخته', '2,650 $'], ['دو تخته', '2,100 $']].flatMap(([label, value], index) => [
      field('rate-label-' + index, 'عنوان نرخ ' + (index + 1), label, [38 + index * 168, 707, 153, 29], 24, { color: '#fff', background: '#008d75' }),
      field('rate-' + index, 'قیمت ' + label, value, [38 + index * 168, 751, 153, 67], 32, { ltr: true, background: '#f0f1f1' })]),
    field('commission', 'کمیسیون', 'تماس بفرمایید', [50, 907, 195, 26], 23, { background: '#e6f5ff' }),
    field('child-flight', 'نرخ پرواز کودک', '115,000,000\nتومان', [264, 901, 196, 32], 21, { background: '#e6f5ff' }),
    field('adult-flight', 'نرخ پرواز بزرگسال', '140,000,000\nتومان', [486, 901, 199, 32], 21, { background: '#e6f5ff' }),
    ...['شانگهای', 'ژانگ جیاجی', 'چنگدو', 'پکن'].flatMap((city, index) => [photo('city-photo-' + index, 'عکس ' + city, [762 + index * 173, 171, 157, 166], 13),
      field('city-caption-' + index, 'عنوان ' + city, city, [767 + index * 173, 346, 145, 31], 24),
      field('city-description-' + index, 'معرفی ' + city, ['شهری مدرن و پویا', 'طبیعتی شگفت‌انگیز', 'شهر پانداها', 'تاریخ، فرهنگ، شکوه'][index], [767 + index * 173, 382, 145, 20], 17)]),
    field('services', 'خدمات تور', 'پرواز رفت و برگشت با ماهان ایر، ویزای توریستی، ترانسفر فرودگاهی، اقامت با صبحانه، پرواز داخلی، قطار سریع‌السیر، گشت شهری، ناهار، راهنمای فارسی‌زبان، بیمه مسافرتی', [774, 514, 674, 144], 28, { background: '#f0faff' }),
    field('travel-summary', 'خلاصه سفر', 'مقصد: چین\nمسیر: شانگهای، ژانگ جیاجی، چنگدو، پکن\nمدت: ۱۰ شب و ۱۱ روز\nتاریخ: ۲۱ آبان\nایرلاین: ماهان ایر\nنوع تور: گروهی', [789, 733, 249, 235], 24),
    field('notes', 'نکات مهم', 'نرخ کودک زیر ۲ سال: ۳۵۰ دلار + هزینه پرواز.\nپرداخت ۵۰٪ مبلغ تور هنگام رزرو الزامی است.\nمسئولیت کنترل پاسپورت و ممنوعیت خروج بر عهده مسافر است.', [1082, 719, 367, 83], 22),
    field('visa-documents', 'مدارک ویزا', 'اصل پاسپورت، اسکن شناسنامه، فرم مشخصات فردی، دو قطعه عکس، تمکن مالی طبق شرایط اعلامی', [1083, 851, 366, 126], 25),
    ...contact([71, 1017, 116, 30], null, null, [238, 1019, 326, 28]).map(f => ({ ...f, size: 17, color: '#fff', background: '#074381' })),
    field('address-second', 'آدرس صفحه دوم', 'تهران، جردن، تقاطع میرداماد، کنار گذر مدرس، پلاک ۳۸۶، طبقه سوم', [821, 1016, 496, 31], 19, { color: '#fff', background: '#074381' }) ]);
  // Keep the printed service icons intact: edit each caption in its own cell.
  const luxury = templates['package-vietnam-luxury'];
  luxury.fields = luxury.fields.filter(f => f.id !== 'services');
  luxury.fields.push(field('service-title', 'عنوان خدمات تور', 'خدمات تور', [1003, 414, 187, 27], 27, { background: '#e3f5ff' }));
  ['خدمات اخذ ویزای ویتنام همراه با پرداخت ورودی سفارت', 'خدمات فست ترک فرودگاه هوشی‌مین', 'پرداخت کلیه ورودی‌های جاذبه‌های توریستی', 'انجام تمامی گشت‌ها و ترانسفرها با اتوبوس مدرن', 'راهنمای مجرب فارسی‌زبان از ایران تا انتهای سفر', 'پرواز داخلی از هوشی‌مین به دانانگ، دانانگ به هانوی', '۹ شب و ۱۰ روز اقامت در هتل و کشتی کروز', '۹ وعده صبحانه، ۷ وعده ناهار و ۶ وعده شام', 'بیمه مسافرتی با سقف ۳۰ هزار یورو با پوشش کرونا'].forEach((text, index) => {
    const row = index < 4 ? 0 : 1, col = row ? index - 4 : index;
    luxury.fields.push(field('service-' + index, 'خدمات تور ' + (index + 1), text,
      row ? [771 + col * 140, 587, 132, 51] : [773 + col * 174, 487, 164, 47], 17, { background: '#f3faff' }));
  });
  const china = templates['package-china'];
  china.fields = china.fields.filter(f => f.id !== 'services');
  china.fields.push(field('service-title', 'عنوان خدمات تور', 'خدمات تور', [1008, 422, 215, 25], 28, { background: '#f0faff' }));
  ['پرواز رفت و برگشت با هواپیمایی ماهان ایر', 'ویزای گروهی توریستی یا انفرادی توریستی', 'ترانسفرهای فرودگاهی', '۱۰ شب اقامت در هتل ۵ ستاره با صبحانه', 'پرواز داخلی از شانگهای به ژانگ جیاجی', 'قطار سریع‌السیر از ژانگ جیاجی به چنگدو', 'پرواز داخلی از چنگدو به پکن', 'گشت‌های شهری در هر شهر', '۵ وعده ناهار طبق برنامه تور', 'راهنمای فارسی مجرب از تهران در تمام طول سفر'].forEach((text, index) => {
    const row = Math.floor(index / 5), col = index % 5;
    china.fields.push(field('service-' + index, 'خدمات تور ' + (index + 1), text, [777 + col * 137, 513 + row * 106, 129, 38], 17, { background: '#f3faff' }));
  });
  for (const [id, template] of Object.entries(templates)) {
    window.TEMPLATES[id] = { ...template, gallery: true, style: id, title: template.label,
      font: 20, color: '#07276b', cardSlots: [], fixedCardSlots: true, columns: [], rows: 1 };
  }
  return templates;
})();
