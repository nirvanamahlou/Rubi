import { normalizeQuestion } from './question-text';

const cards = {
  customers: ['مشتریان b2c',/^(?:کل )?(?:مشتریان|مشتری های) (?:b2c|حقیقی)$/u],
  passengers: ['مسافران b2c',/^(?:کل )?مسافران (?:b2c|مشتریان حقیقی)$/u],
  newCustomers: ['مشتریان جدید سه ماه اخیر',/^مشتریان جدید (?:b2c )?سه ماه اخیر(?: b2c)?$/u],
  returnRate: ['نرخ بازگشت مشتری',/^نرخ بازگشت مشتری(?:ان)? (?:b2c|حقیقی)$/u],
  agencies: ['آژانس‌های همکار',/^(?:کل )?آژانس(?: ها| های)? همکار(?: b2b)?$/u],
  corporations: ['مشتریان سازمانی',/^(?:کل )?مشتری(?:ان| های)? سازمانی(?: b2b)?$/u],
  purchases: ['کل خریدهای خدمات',/^(?:کل )?خرید(?:های| های) خدمات$/u],
  pending: ['در انتظار ثبت خرید',/^(?:خرید(?:های| های) خدمات )?در انتظار ثبت خرید$/u],
  registered: ['خریدهای ثبت‌شده',/^خرید(?:های| های)(?: خدمات)? ثبت شده(?: خدمات)?$/u],
  uncertain: ['خریدهای با وضعیت نامشخص',/^خرید(?:های| های)(?: خدمات)? با وضعیت نامشخص$/u],
  today: ['تماس‌های امروز',/^تماس(?: های|ات| ها)? امروز(?: کال سنتر)?$/u],
  week: ['تماس‌های این هفته',/^تماس(?: های|ات| ها)? این هفته(?: کال سنتر)?$/u],
  withoutOutcome: ['تماس‌های بدون نتیجه',/^تماس(?: های|ات| ها)? بدون نتیجه(?: کال سنتر)?$/u],
  needsFollowUp: ['تماس‌های ازدست‌رفتهٔ نیازمند تماس مجدد',/^تماس(?: های|ات| ها)? (?:از دست|ازدست) رفته نیازمند تماس مجدد(?: کال سنتر)?$/u],
} as const;

export type PanelIntent =
  | {kind:'card';key:keyof typeof cards;label:string}
  | {kind:'b2b-status';role:'AGENCY'|'CORPORATE_CUSTOMER';code:string}
  | {kind:'b2c-status';name:string}
  | {kind:'unsupported'};

export function panelIntent(question:string):PanelIntent|null {
  const text=normalizeQuestion(question).replace(/^لطفا /u,'');
  if(/راهنما|چطور|چجور|چگونه|چرا|از کجا|نحوه|مراحل/u.test(text))return null;
  const status=/^وضعیت (آژانس(?: همکار)?|مشتری سازمانی) (?:با )?کد ([a-z0-9][a-z0-9_-]{0,79})(?: (?:چیست|چیه|رو بگو|را بگو))?$/u.exec(text);
  if(status)return {kind:'b2b-status',role:status[1]!.startsWith('آژانس')?'AGENCY':'CORPORATE_CUSTOMER',code:status[2]!};
  const customer=/^(?:لطفا )?وضعیت پرونده مشتری (?:B2C|حقیقی) [«"]([^«»"\r\n]{2,100})[»"](?: (?:چیست|چیه|رو بگو|را بگو))?[؟?]?$/iu.exec(question.trim());
  if(customer)return {kind:'b2c-status',name:customer[1]!.trim()};
  const phrase=text.replace(/^(?:(?:تعداد|چند تا|چند) )/u,'')
    .replace(/ (?:چند(?: تا)?(?:ست| است| هستند| داریم)?|چندتاست|چقدره|چقدر است|چقدر بوده|را بگو|رو بگو|داریم|هستند|هست)$/u,'');
  for(const [id,[label,pattern]] of Object.entries(cards)){
    if(pattern.test(phrase))return {kind:'card',key:id as keyof typeof cards,label};
  }
  if(/تعداد|چند|چقدر|وضعیت|نرخ بازگشت/u.test(text)&&/b2b|b2c|مشتری سازمانی|آژانس همکار|خرید(?:های| های) خدمات|کال سنتر/u.test(text))return {kind:'unsupported'};
  return null;
}
export const isOperationalPanelQuestion=(question:string)=>panelIntent(question)!==null;
