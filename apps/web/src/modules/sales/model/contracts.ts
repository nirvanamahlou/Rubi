export const contractSteps = [
  'اطلاعات قرارداد',
  'مسافران',
  'تخصیص خدمات',
  'قیمت و شرایط',
  'تأیید و امضا',
] as const;

export type ContractStage =
  'نیازمند اقدام' | 'در حال تکمیل' | 'آماده اجرا' | 'بسته‌شده';

export interface SalesContractPreview {
  id: string;
  title: string;
  customer: string;
  destination: string;
  travelDate: string;
  updatedAt: string;
  owner: string;
  stage: ContractStage;
  currentStep: number;
  progress: number;
  passengers: number;
  services: number;
  allocatedServices: number;
  amount: string;
  paymentStatus: string;
  nextAction: string;
  urgency?: string;
  serviceLabels: readonly string[];
}

export const salesContractPreviews: readonly SalesContractPreview[] = [
  {
    id: 'NSS-1405-0412',
    title: 'تور خانوادگی کیش',
    customer: 'خانواده محمدی (نمونه)',
    destination: 'کیش',
    travelDate: '۲۲ شهریور ۱۴۰۵',
    updatedAt: 'امروز، ۱۰:۴۵',
    owner: 'نیایش رضایی',
    stage: 'نیازمند اقدام',
    currentStep: 3,
    progress: 48,
    passengers: 4,
    services: 5,
    allocatedServices: 3,
    amount: '۱۲۸٬۴۰۰٬۰۰۰ تومان',
    paymentStatus: 'پیش‌پرداخت ثبت نشده',
    nextAction: 'اتاق دو مسافر هنوز مشخص نشده است',
    urgency: 'تا پایان امروز',
    serviceLabels: ['پرواز رفت‌وبرگشت', 'هتل', 'ترانسفر', 'بیمه', 'CIP'],
  },
  {
    id: 'NSS-1405-0408',
    title: 'سفر کاری استانبول',
    customer: 'شرکت سپهر آبی (نمونه)',
    destination: 'استانبول',
    travelDate: '۴ مهر ۱۴۰۵',
    updatedAt: 'دیروز، ۱۶:۲۰',
    owner: 'سارا احمدی',
    stage: 'در حال تکمیل',
    currentStep: 4,
    progress: 76,
    passengers: 2,
    services: 4,
    allocatedServices: 4,
    amount: '۲٬۸۴۰ یورو',
    paymentStatus: 'شرایط پرداخت در انتظار تأیید',
    nextAction: 'شرایط کنسلی و سررسید قسط را تأیید کنید',
    serviceLabels: ['پرواز', 'هتل', 'ترانسفر', 'بیمه'],
  },
  {
    id: 'NSS-1405-0399',
    title: 'تور نمایشگاهی دبی',
    customer: 'آژانس سفرنگار (نمونه)',
    destination: 'دبی',
    travelDate: '۱۸ مهر ۱۴۰۵',
    updatedAt: '۲ روز پیش',
    owner: 'امیر مرادی',
    stage: 'آماده اجرا',
    currentStep: 5,
    progress: 100,
    passengers: 8,
    services: 3,
    allocatedServices: 3,
    amount: '۹٬۷۶۰ دلار',
    paymentStatus: 'پیش‌پرداخت تأیید شده',
    nextAction: 'انتشار Snapshot برای مالی و رزرواسیون',
    serviceLabels: ['پرواز', 'هتل', 'ویزای امارات'],
  },
  {
    id: 'NSS-1405-0416',
    title: 'پرواز تهران به شیراز',
    customer: 'مریم زمانی (نمونه)',
    destination: 'شیراز',
    travelDate: '۱۴ شهریور ۱۴۰۵',
    updatedAt: 'امروز، ۰۹:۱۰',
    owner: 'نیایش رضایی',
    stage: 'در حال تکمیل',
    currentStep: 1,
    progress: 18,
    passengers: 1,
    services: 1,
    allocatedServices: 0,
    amount: '—',
    paymentStatus: 'قیمت‌گذاری نشده',
    nextAction: 'پرداخت‌کننده و تاریخ اعتبار پیشنهاد را مشخص کنید',
    serviceLabels: ['پرواز یک‌طرفه'],
  },
];

export function filterContracts(
  contracts: readonly SalesContractPreview[],
  query: string,
  stage: 'همه' | ContractStage,
) {
  const normalized = query.trim().toLocaleLowerCase('fa');
  return contracts.filter(
    (contract) =>
      (stage === 'همه' || contract.stage === stage) &&
      (!normalized ||
        contract.title.toLocaleLowerCase('fa').includes(normalized) ||
        contract.customer.toLocaleLowerCase('fa').includes(normalized) ||
        contract.id.toLocaleLowerCase('fa').includes(normalized) ||
        contract.destination.toLocaleLowerCase('fa').includes(normalized)),
  );
}
