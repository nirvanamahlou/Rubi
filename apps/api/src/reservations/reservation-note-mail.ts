import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type {
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';

export type ReservationNoteIntent = {
  brokerId: string;
  scope: string;
  text: string;
};

/** Snapshot the selected form only; internal workflow notes are never mailed. */
export function reservationNoteIntent(
  state: TravelWorkflowStateV1,
  command: TravelWorkflowCommandV1,
): ReservationNoteIntent {
  const settings = command.hotelStayKey
    ? state.hotelSupplierForms?.[command.hotelStayKey]?.settings
    : state.supplierFormSettings;
  if (!settings?.brokerId)
    throw new Error('پیش از ارسال ایمیل، کارگزار فرم را انتخاب کنید.');
  const text = settings.text.remarks ?? '';
  if (text.length > 500 || text.includes('\0'))
    throw new Error(
      'یادداشت فرم رزرواسیون باید حداکثر ۵۰۰ نویسه معتبر داشته باشد.',
    );
  return {
    brokerId: settings.brokerId,
    scope: command.hotelStayKey ?? 'primary',
    text,
  };
}

export function mailKey(encoded: string | undefined) {
  const key = Buffer.from(encoded ?? '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded)
    throw new Error('MAIL_ENCRYPTION_CONFIGURATION');
  return key;
}

/** Each envelope is bound to its durable row; ciphertext cannot be swapped. */
export function sealMail(value: unknown, key: Buffer, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(id));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((v) => v.toString('base64'))
    .join('.');
}

export function openMail(value: string, key: Buffer, id: string): unknown {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('INVALID_MAIL_ENVELOPE');
  const [iv, tag, data] = parts.map((v) => {
    const decoded = Buffer.from(v, 'base64');
    if (decoded.toString('base64') !== v)
      throw new Error('INVALID_MAIL_ENVELOPE');
    return decoded;
  });
  const cipher = createDecipheriv('aes-256-gcm', key, iv!);
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(tag!);
  return JSON.parse(
    Buffer.concat([cipher.update(data!), cipher.final()]).toString('utf8'),
  );
}
