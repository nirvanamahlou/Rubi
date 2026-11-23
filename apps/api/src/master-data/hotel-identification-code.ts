import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

const persianLetters: Record<string, string> = {
  ا: 'A',
  ب: 'B',
  پ: 'P',
  ت: 'T',
  ث: 'S',
  ج: 'J',
  چ: 'CH',
  ح: 'H',
  خ: 'KH',
  د: 'D',
  ذ: 'Z',
  ر: 'R',
  ز: 'Z',
  ژ: 'ZH',
  س: 'S',
  ش: 'SH',
  ص: 'S',
  ض: 'Z',
  ط: 'T',
  ظ: 'Z',
  ع: 'A',
  غ: 'GH',
  ف: 'F',
  ق: 'Q',
  ک: 'K',
  ك: 'K',
  گ: 'G',
  ل: 'L',
  م: 'M',
  ن: 'N',
  و: 'V',
  ه: 'H',
  ی: 'Y',
  ي: 'Y',
  ى: 'Y',
};

function namePrefix(value: string) {
  const letters = [...value.normalize('NFKD').toUpperCase()]
    .map((letter) => persianLetters[letter] ?? letter)
    .join('')
    .replace(/[^A-Z]/g, '');
  return letters ? letters.slice(0, 3).padEnd(3, 'X') : undefined;
}

export async function lockHotelIdentificationCodes(
  tx: Prisma.TransactionClient,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('master-hotel-identification-code', 0))::text`;
}

export async function assertHotelIdentificationCodeAvailable(
  tx: Prisma.TransactionClient,
  code: string,
  hotelId: string | null = null,
) {
  const [result] = await tx.$queryRaw<{ used: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM master_hotels
      WHERE upper(trim("identificationCode")) = upper(${code})
        AND (${hotelId}::uuid IS NULL OR id <> ${hotelId}::uuid)
    ) AS used
  `;
  if (result?.used)
    throw new ConflictException('شناسه یا کد تکراری مجاز نیست.');
}

// The caller reserves the hotel identity lock before writing any hotel rows.
export async function allocateHotelIdentificationCode(
  tx: Prisma.TransactionClient,
  cityId: string,
): Promise<string> {
  const [existing] = await tx.$queryRaw<{ prefix: string }[]>`
    SELECT upper(substring(trim("identificationCode") from '(?i)^HTL-([A-Z]{3})-[0-9]+$')) AS prefix
    FROM master_hotels
    WHERE "cityId" = ${cityId}::uuid
      AND trim("identificationCode") ~* '^HTL-[A-Z]{3}-[0-9]+$'
    GROUP BY 1 ORDER BY count(*) DESC, prefix LIMIT 1
  `;
  let prefix = existing?.prefix;
  if (!prefix) {
    const city = await tx.masterCity.findUniqueOrThrow({
      where: { id: cityId },
      select: {
        code: true,
        name: true,
        englishName: true,
        airports: {
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { iataCode: 'asc' }],
          select: { iataCode: true },
          take: 1,
        },
      },
    });
    const cityCode = city.code.trim().toUpperCase();
    const airport = city.airports[0]?.iataCode.trim().toUpperCase() ?? '';
    prefix = /^[A-Z]{3}$/.test(cityCode)
      ? cityCode
      : /^[A-Z]{3}$/.test(airport)
        ? airport
        : (namePrefix(city.englishName ?? '') ??
          namePrefix(city.name) ??
          namePrefix(cityCode.replace(/^CITY_/, '')) ??
          'XXX');
  }
  const [allocated] = await tx.$queryRaw<{ number: string }[]>`
    WITH issued AS (
      SELECT nextval('master_hotel_identification_number_seq') AS number
    ), recorded AS (
      SELECT max(substring(trim("identificationCode") from '(?i)^HTL-[A-Z]{3}-([0-9]{1,18})$')::bigint) AS number
      FROM master_hotels
    )
    SELECT (CASE WHEN issued.number <= recorded.number
      THEN setval('master_hotel_identification_number_seq', recorded.number + 1)
      ELSE issued.number END)::text AS number
    FROM issued CROSS JOIN recorded
  `;
  return `HTL-${prefix}-${allocated!.number.padStart(3, '0')}`;
}
