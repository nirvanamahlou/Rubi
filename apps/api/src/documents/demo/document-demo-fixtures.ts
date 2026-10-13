import { deflateSync } from 'node:zlib';

const DAY_MS = 24 * 60 * 60 * 1000;

type Rgb = readonly [red: number, green: number, blue: number];

export interface DocumentDemoFixture {
  key: string;
  documentId: string;
  versionId: string;
  storageFileId: string;
  title: string;
  description: string;
  documentTypeCode: string;
  categoryCode: string;
  confidentiality: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  sourceEntityType: string;
  sourceEntityId: string;
  sourceDisplayLabel: string;
  originalFileName: string;
  validUntil: Date | null;
  createdAt: Date;
  contents: Buffer;
}

interface FixtureDefinition {
  key: string;
  documentId: string;
  versionId: string;
  storageFileId: string;
  title: string;
  description: string;
  documentTypeCode: string;
  categoryCode: string;
  confidentiality: DocumentDemoFixture['confidentiality'];
  sourceEntityType: string;
  sourceDisplayLabel: string;
  fileName: string;
  validForDays: number | null;
  createdDaysAgo: number;
  palette: readonly [Rgb, Rgb, Rgb];
  variant: number;
}

const fixtureDefinitions: readonly FixtureDefinition[] = [
  {
    key: 'passenger-passport',
    documentId: 'd003c000-0000-4000-8000-000000000001',
    versionId: 'd003c100-0000-4000-8000-000000000001',
    storageFileId: 'd003c200-0000-4000-8000-000000000001',
    title: 'پاسپورت آزمایشی مسافر ۰۱',
    description: 'تصویر کاملاً ساختگی برای نمایش جریان امن مدارک هویتی.',
    documentTypeCode: 'PASSPORT',
    categoryCode: 'CUSTOMER_IDENTITY',
    confidentiality: 'CONFIDENTIAL',
    sourceEntityType: 'SyntheticPassengerCase',
    sourceDisplayLabel: 'پرونده آزمایشی مسافر ۰۱',
    fileName: 'synthetic-passport-01.png',
    validForDays: 180,
    createdDaysAgo: 1,
    palette: [
      [15, 72, 142],
      [54, 163, 219],
      [225, 244, 255],
    ],
    variant: 1,
  },
  {
    key: 'passenger-translation',
    documentId: 'd003c000-0000-4000-8000-000000000002',
    versionId: 'd003c100-0000-4000-8000-000000000002',
    storageFileId: 'd003c200-0000-4000-8000-000000000002',
    title: 'ترجمه مدارک آزمایشی مسافر ۰۲',
    description: 'نمونه تصویری غیرواقعی برای دسته مدارک مشتری.',
    documentTypeCode: 'CUSTOMER_DOCUMENT',
    categoryCode: 'CUSTOMER_IDENTITY',
    confidentiality: 'CONFIDENTIAL',
    sourceEntityType: 'SyntheticPassengerCase',
    sourceDisplayLabel: 'پرونده آزمایشی مسافر ۰۲',
    fileName: 'synthetic-translation-02.png',
    validForDays: null,
    createdDaysAgo: 2,
    palette: [
      [91, 51, 160],
      [153, 102, 214],
      [244, 235, 255],
    ],
    variant: 2,
  },
  {
    key: 'group-quotation',
    documentId: 'd003c000-0000-4000-8000-000000000003',
    versionId: 'd003c100-0000-4000-8000-000000000003',
    storageFileId: 'd003c200-0000-4000-8000-000000000003',
    title: 'پیشنهاد سفر گروهی آزمایشی استانبول',
    description: 'پیشنهاد قیمت ساختگی و بدون مبلغ واقعی یا اطلاعات مسافر.',
    documentTypeCode: 'QUOTATION',
    categoryCode: 'SALES_CONTRACTS',
    confidentiality: 'INTERNAL',
    sourceEntityType: 'SyntheticSalesCase',
    sourceDisplayLabel: 'فروش گروهی آزمایشی استانبول',
    fileName: 'synthetic-group-quotation.png',
    validForDays: 25,
    createdDaysAgo: 3,
    palette: [
      [7, 126, 119],
      [45, 194, 160],
      [225, 250, 244],
    ],
    variant: 3,
  },
  {
    key: 'group-contract',
    documentId: 'd003c000-0000-4000-8000-000000000004',
    versionId: 'd003c100-0000-4000-8000-000000000004',
    storageFileId: 'd003c200-0000-4000-8000-000000000004',
    title: 'قرارداد سفر گروه آزمایشی آفتاب',
    description: 'قرارداد نمایشی؛ فاقد طرف واقعی، مبلغ و تعهد حقوقی.',
    documentTypeCode: 'CONTRACT',
    categoryCode: 'SALES_CONTRACTS',
    confidentiality: 'CONFIDENTIAL',
    sourceEntityType: 'SyntheticSalesContract',
    sourceDisplayLabel: 'قرارداد آزمایشی گروه آفتاب',
    fileName: 'synthetic-group-contract.png',
    validForDays: 365,
    createdDaysAgo: 4,
    palette: [
      [178, 83, 11],
      [245, 158, 11],
      [255, 247, 222],
    ],
    variant: 4,
  },
  {
    key: 'hotel-voucher',
    documentId: 'd003c000-0000-4000-8000-000000000005',
    versionId: 'd003c100-0000-4000-8000-000000000005',
    storageFileId: 'd003c200-0000-4000-8000-000000000005',
    title: 'واچر هتل آزمایشی استانبول',
    description: 'واچر منقضی و کاملاً ساختگی برای نمایش وضعیت بازبینی.',
    documentTypeCode: 'VOUCHER',
    categoryCode: 'TRAVEL_RESERVATIONS',
    confidentiality: 'INTERNAL',
    sourceEntityType: 'SyntheticReservation',
    sourceDisplayLabel: 'رزرو آزمایشی هتل استانبول',
    fileName: 'synthetic-hotel-voucher.png',
    validForDays: -7,
    createdDaysAgo: 6,
    palette: [
      [30, 101, 174],
      [99, 179, 237],
      [231, 246, 255],
    ],
    variant: 5,
  },
  {
    key: 'procurement-order',
    documentId: 'd003c000-0000-4000-8000-000000000006',
    versionId: 'd003c100-0000-4000-8000-000000000006',
    storageFileId: 'd003c200-0000-4000-8000-000000000006',
    title: 'سفارش خرید آزمایشی خدمات سفر',
    description: 'فرم ساختگی خرید بدون تأمین‌کننده، قیمت یا حساب واقعی.',
    documentTypeCode: 'PROCUREMENT_DOCUMENT',
    categoryCode: 'PROCUREMENT_FINANCE',
    confidentiality: 'INTERNAL',
    sourceEntityType: 'SyntheticPurchaseOrder',
    sourceDisplayLabel: 'سفارش خرید آزمایشی خدمات سفر',
    fileName: 'synthetic-procurement-order.png',
    validForDays: null,
    createdDaysAgo: 8,
    palette: [
      [61, 89, 112],
      [107, 143, 171],
      [237, 244, 248],
    ],
    variant: 6,
  },
  {
    key: 'employee-training',
    documentId: 'd003c000-0000-4000-8000-000000000007',
    versionId: 'd003c100-0000-4000-8000-000000000007',
    storageFileId: 'd003c200-0000-4000-8000-000000000007',
    title: 'گواهی آموزشی آزمایشی کارمند',
    description: 'گواهی کاملاً ساختگی برای نمایش اسناد محدود منابع انسانی.',
    documentTypeCode: 'HR_DOCUMENT',
    categoryCode: 'ORGANIZATION_HR',
    confidentiality: 'RESTRICTED',
    sourceEntityType: 'SyntheticEmployeeRecord',
    sourceDisplayLabel: 'پرونده آموزشی آزمایشی کارمند',
    fileName: 'synthetic-employee-training.png',
    validForDays: 14,
    createdDaysAgo: 10,
    palette: [
      [176, 45, 90],
      [235, 100, 145],
      [255, 235, 243],
    ],
    variant: 7,
  },
] as const;

function crc32(contents: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, contents: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(contents.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, contents])));
  return Buffer.concat([length, typeBuffer, contents, checksum]);
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  return [
    Math.round(left[0] + (right[0] - left[0]) * amount),
    Math.round(left[1] + (right[1] - left[1]) * amount),
    Math.round(left[2] + (right[2] - left[2]) * amount),
  ];
}

export function createSyntheticDocumentPng(
  palette: readonly [Rgb, Rgb, Rgb],
  variant: number,
): Buffer {
  const width = 640;
  const height = 360;
  const scanlines = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const background = mix(palette[2], [255, 255, 255], y / height / 2);
      let color = background;
      if (y < 72) color = mix(palette[0], palette[1], x / width);
      if (x < 20) color = palette[0];
      if (x > 430 && x < 590 && y > 112 && y < 282) color = palette[1];
      if (x > 448 && x < 572 && y > 130 && y < 264)
        color = mix(palette[2], [255, 255, 255], 0.35);
      for (let line = 0; line < 4; line++) {
        const top = 122 + line * 38 + ((variant + line) % 3) * 3;
        const right = 300 + ((variant * 31 + line * 47) % 100);
        if (x > 62 && x < right && y > top && y < top + 12)
          color = mix(palette[0], palette[1], line / 5);
      }
      if (
        (x - (510 + (variant % 3) * 5)) ** 2 +
          (y - (196 + (variant % 2) * 4)) ** 2 <
        38 ** 2
      )
        color = palette[0];
      scanlines[offset++] = color[0];
      scanlines[offset++] = color[1];
      scanlines[offset++] = color[2];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function documentDemoFixtures(now = new Date()): DocumentDemoFixture[] {
  return fixtureDefinitions.map((fixture) => ({
    key: fixture.key,
    documentId: fixture.documentId,
    versionId: fixture.versionId,
    storageFileId: fixture.storageFileId,
    title: fixture.title,
    description: fixture.description,
    documentTypeCode: fixture.documentTypeCode,
    categoryCode: fixture.categoryCode,
    confidentiality: fixture.confidentiality,
    sourceEntityType: fixture.sourceEntityType,
    sourceEntityId: `documents-demo-v1/${fixture.key}`,
    sourceDisplayLabel: fixture.sourceDisplayLabel,
    originalFileName: fixture.fileName,
    validUntil:
      fixture.validForDays === null
        ? null
        : new Date(now.getTime() + fixture.validForDays * DAY_MS),
    createdAt: new Date(now.getTime() - fixture.createdDaysAgo * DAY_MS),
    contents: createSyntheticDocumentPng(fixture.palette, fixture.variant),
  }));
}
