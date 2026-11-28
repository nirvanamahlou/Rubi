import { normalizeQuestion } from './question-text';
import { isInsuranceSummary } from './insurance-report';

const subjects = {
  contracts: ['قراردادهای فروش'],
  registeredContracts: ['قراردادهای ثبت شده'],
  confirmed: ['قراردادهای قطعی'],
  personContracts: ['قراردادهای مشتری حقیقی', 'قراردادهای اشخاص حقیقی'],
  agencyContracts: ['فروش آژانسی', 'قراردادهای آژانسی'],
  salePassengers: ['مسافران قراردادهای فروش'],
  discountContracts: ['قراردادهای دارای تخفیف'],
  tourPackages: ['تورهای تعریف شده'],
  unsettled: ['قراردادهای تسویه نشده'],
  settled: ['قراردادهای تسویه کامل'],
  positiveBalance: ['قراردادهای با مانده مثبت'],
  cancelled: ['قراردادهای لغوشده', 'قراردادهای لغو شده'],
  hotelContracts: ['قراردادهای دارای خدمت هتل'],
  visaContracts: ['قراردادهای دارای خدمت ویزا'],
  cancelledVisa: [
    'قراردادهای لغوشده دارای ویزا',
    'قراردادهای لغو شده دارای ویزا',
  ],
  customers: ['مشتریان شخصی', 'مشتریان حقیقی'],
  newCustomers: ['مشتریان شخصی جدید', 'مشتریان حقیقی جدید'],
  agencies: ['آژانس های همکار'],
  organizations: ['مشتریان سازمانی'],
  policies: ['بیمه نامه های مسافرتی', 'بیمه نامه ها'],
  insuranceSummary: ['خلاصه بیمه نامه های مسافرتی'],
  reviewPolicies: ['بیمه نامه های نیازمند بررسی'],
  callsWithoutOutcome: ['تماس های بدون نتیجه'],
  callbacks: ['تماس های نیازمند پیگیری'],
  reservationRequests: ['درخواست های رزرواسیون'],
  flightServices: ['خدمات پرواز'],
  hotelServices: ['خدمات هتل'],
  users: ['حساب های کاربری فعال'],
  roles: ['نقش های تعریف شده'],
  campaigns: ['کمپین های بازاریابی'],
  employees: ['کارکنان فعال', 'پرسنل فعال'],
  formerEmployees: ['کارکنان سابق'],
  archivedDocuments: ['اسناد بایگانی شده'],
  pendingScan: ['سندهای نیازمند اسکن', 'اسناد نیازمند اسکن'],
  hrLetters: ['نامه های وارده منابع انسانی'],
  purchases: ['خریدهای خدمات', 'درخواست های خرید خدمات'],
  pendingPurchases: ['خریدهای در انتظار ثبت'],
  registeredPurchases: ['خریدهای ثبت شده'],
  permits: ['مجوزهای تحویل مدارک'],
  permitExceptions: ['استثناهای مجوز تحویل'],
  pendingReceipts: [
    'دریافت های در انتظار تایید',
    'رسیدهای تاییدنشده',
    'رسیدهای تایید نشده',
  ],
  approvedReceipts: ['دریافت های تاییدشده', 'دریافت های تایید شده'],
  pettyExpenses: ['هزینه های تنخواه'],
  pettyFunds: ['حساب های تنخواه'],
  postedJournals: ['سندهای قطعی حسابداری'],
  draftJournals: ['سندهای پیش نویس حسابداری'],
  dailyLeave: ['درخواست های مرخصی روزانه'],
  hourlyLeave: ['درخواست های مرخصی ساعتی'],
  attendance: ['درخواست های اصلاح تردد'],
  advances: ['درخواست های مساعده'],
  hrPending: ['درخواست های در انتظار تایید منابع انسانی'],
} as const;
export type RecordSubject = keyof typeof subjects;
export type RecordShape = 'count' | 'list' | 'branch' | 'company';
export type RecordRequest = {
  subject: RecordSubject;
  shape: RecordShape;
  title: string;
};

function normal(text: string) {
  return normalizeQuestion(text)
    .replace(/أ/gu, 'ا')
    .replace(/ (های|ها)(?= |$)/gu, '$1');
}
const byPhrase = new Map<string, RecordSubject>();
for (const key of Object.keys(subjects) as RecordSubject[]) {
  for (const label of subjects[key]) byPhrase.set(normal(label), key);
}

// Match the whole subject and modifiers. Extra constraints must remain available to the planner.
export function ownerRecordRequest(question: string): RecordRequest | null {
  const text = normal(question).replace(/^(?:لطفا |الان )+/u, '');
  const patterns: readonly [RecordShape, RegExp][] = [
    [
      'branch',
      /^(?:تعداد )?(.+?) (?:رو |را )?به تفکیک شعبه(?: و در کل)?(?: بده| بگو)?(?: موارد بدون شعبه چندتا هستن)?$/u,
    ],
    [
      'company',
      /^شرکتها (?:رو|را) به ترتیب تعداد (.+?) مرتب کن(?: تعداد هر شرکت (?:رو|را) هم بنویس)?$/u,
    ],
    [
      'list',
      /^(?:فهرست|لیست) (.+?) (?:رو|را) (?:بده|نشان بده|نشون بده)(?: اگه بیشتر از ده مورده ده مورد اول رو به ترتیب شناسه با تعداد کل نشون بده)?$/u,
    ],
    [
      'count',
      /^(?:تعداد |چند تا )(.+?)(?: چنده| چندتاست| چند است| داریم| را بگو| رو بگو| چندتا هستن)?$/u,
    ],
  ];
  for (const [shape, pattern] of patterns) {
    const phrase = pattern.exec(text)?.[1];
    if (!phrase) continue;
    const subject = byPhrase.get(phrase);
    if (subject) return { subject, shape, title: subjects[subject][0] };
  }
  return isInsuranceSummary(question)
    ? {
        subject: 'insuranceSummary',
        shape: 'count',
        title: subjects.insuranceSummary[0],
      }
    : null;
}
