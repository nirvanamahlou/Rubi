export interface PersonalDetails {
  displayName: string;
  email: string;
  phone: string;
}

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function personalDetailsError(details: PersonalDetails): string | null {
  if (!details.displayName.trim()) return 'نام و نام خانوادگی را وارد کنید.';
  if (details.displayName.trim().length > 160)
    return 'نام باید حداکثر ۱۶۰ نویسه باشد.';
  if (
    details.email &&
    (details.email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()))
  )
    return 'ایمیل را به شکل صحیح وارد کنید.';
  if (
    details.phone &&
    (!/^[+\d۰-۹٠-٩\s()-]{7,32}$/.test(details.phone.trim()) ||
      details.phone.replace(/[^\d۰-۹٠-٩]/g, '').length < 7)
  )
    return 'شماره تماس را به شکل صحیح وارد کنید.';
  return null;
}

export function profilePhotoError(
  file: Pick<File, 'size' | 'type'>,
  bytes: Uint8Array,
): string | null {
  if (file.size === 0 || file.size > PROFILE_PHOTO_MAX_BYTES)
    return 'حجم عکس باید بیشتر از صفر و حداکثر ۵ مگابایت باشد.';
  const png =
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80;
  if (
    (file.type === 'image/png' && png) ||
    (file.type === 'image/jpeg' && jpeg) ||
    (file.type === 'image/webp' && webp)
  )
    return null;
  return 'یک عکس معتبر PNG، JPG یا WebP انتخاب کنید.';
}
