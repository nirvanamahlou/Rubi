'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  HR_RADAN_COMPLETION_COLUMNS,
  HR_RADAN_COMPLETION_OPTIONS,
  HR_RADAN_PROVINCES,
} from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { buttonVariants } from '@/components/ui/button';
import styles from './hr-forms.module.css';

export const defaultPersonnelIdentity = [
  '',
  '',
  '',
  '',
  '',
  '',
  'مرد',
  'مجرد',
  '',
  '',
  'نامشخص',
  'ایرانی',
  'نامشخص',
  '',
  '',
];
const digits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (c) =>
    String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)),
  );
export function personnelIdentityError(values: readonly string[]) {
  if (values[2]?.trim() && !/^\d{10}$/.test(digits(values[2].trim())))
    return 'کد ملی باید ده رقم باشد.';
  if (values[14]?.trim() && !/^\d{10}$/.test(digits(values[14].trim())))
    return 'کد پستی باید ده رقم باشد.';
  if (values[9] && !values[8]) return 'ابتدا استان را انتخاب کنید.';
  return '';
}
export function personnelContactError(
  values: readonly string[],
  existing: readonly string[][],
) {
  if (
    !HR_RADAN_COMPLETION_OPTIONS['نوع شماره تماس']!.includes(values[0] ?? '') ||
    !/^[+\d ()-]{3,30}$/.test(digits(values[1]?.trim() ?? ''))
  )
    return 'شماره تماس معتبر نیست.';
  const key = (phone: readonly string[]) =>
    `${phone[0]}:${digits(phone[1] ?? '').replace(/[ ()+-]/g, '')}`;
  if (existing.some((phone) => key(phone) === key(values)))
    return 'شماره تماس تکراری است.';
  if (existing.length >= 20) return 'حداکثر بیست شماره تماس مجاز است.';
  return '';
}
export function PersonnelIdentityFields({
  values,
  onChange,
  groupControl,
  contacts,
  onContacts,
  cityOptions,
  photo,
  photoValidUntil,
  onPhotoValidUntil,
  photoValidityError,
  onPhoto,
  error,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  groupControl: ReactNode;
  cityOptions?: readonly { province: string; city: string }[] | undefined;
  contacts: string[][];
  onContacts: (values: string[][]) => void;
  photo?: File | undefined;
  photoValidUntil?: string | undefined;
  onPhotoValidUntil: (value: string) => void;
  photoValidityError: string;
  onPhoto: (file: File | undefined) => void;
  error: string;
}) {
  const cityListId = useId();
  const photoInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[][]>([]);
  const [phone, setPhone] = useState(['موبایل', '']);
  const [phoneError, setPhoneError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const update = (index: number, value: string) =>
    onChange(
      defaultPersonnelIdentity.map((fallback, i) =>
        i === index
          ? value
          : i === 9 && index === 8
            ? ''
            : (values[i] ?? fallback),
      ),
    );
  return (
    <>
      {HR_RADAN_COMPLETION_COLUMNS['employee.identity']
        .slice(2)
        .map((label, offset) => {
          const index = offset + 2,
            options =
              index === 8
                ? HR_RADAN_PROVINCES
                : HR_RADAN_COMPLETION_OPTIONS[label];
          const radio = index === 6 || index === 7;
          return (
            <div key={label} className={styles.fieldLabel}>
              {radio ? (
                <fieldset className={styles.formFieldset}>
                  <legend>{label}</legend>
                  {options?.map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={`personnel-${index}`}
                        value={option}
                        checked={values[index] === option}
                        onChange={() => update(index, option)}
                      />{' '}
                      {index === 6
                        ? option === 'مرد'
                          ? 'آقا'
                          : 'خانم'
                        : option === 'متأهل'
                          ? 'متاهل'
                          : option}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label className={styles.fieldLabel}>
                  {index === 8
                    ? 'صادره از استان'
                    : index === 9
                      ? 'صادره از شهر'
                      : index === 13
                        ? 'آدرس'
                        : label}
                  {index === 5 ? (
                    <DatePicker
                      value={values[index] ?? ''}
                      onChange={(value) => update(index, value)}
                      aria-label={label}
                    />
                  ) : options ? (
                    <NativeSearchSelect
                      className={styles.control}
                      value={values[index] ?? ''}
                      onChange={(event) => update(index, event.target.value)}
                    >
                      <option value="">انتخاب کنید</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeSearchSelect>
                  ) : index === 13 ? (
                    <textarea
                      className={styles.control}
                      value={values[index] ?? ''}
                      maxLength={500}
                      onChange={(event) => update(index, event.target.value)}
                    />
                  ) : (
                    <input
                      className={styles.control}
                      value={values[index] ?? ''}
                      inputMode={
                        [2, 3, 14].includes(index) ? 'numeric' : 'text'
                      }
                      dir={[2, 3, 14].includes(index) ? 'ltr' : undefined}
                      autoComplete={index === 14 ? 'postal-code' : undefined}
                      maxLength={index === 2 || index === 14 ? 10 : 160}
                      onChange={(event) => update(index, event.target.value)}
                      disabled={index === 9 && !values[8]}
                      list={index === 9 ? cityListId : undefined}
                    />
                  )}
                  {index === 9 ? (
                    <datalist id={cityListId}>
                      {Array.from(
                        new Set(
                          cityOptions
                            ?.filter((option) => option.province === values[8])
                            .map((option) => option.city) ?? [],
                        ),
                      ).map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  ) : null}
                  {index === 2 && error ? (
                    <small role="alert" className={styles.fieldError}>
                      {error}
                    </small>
                  ) : null}
                </label>
              )}
              {index === 2 ? groupControl : null}
            </div>
          );
        })}
      <div className={styles.fieldLabel}>
        <button
          className={buttonVariants({ variant: 'outline' })}
          type="button"
          onClick={() => {
            setDraft(contacts.map((p) => [...p]));
            setPhoneError('');
            setPhone(['موبایل', '']);
            setOpen(true);
          }}
        >
          شماره‌های تماس ({contacts.length})
        </button>
      </div>
      <label className={styles.fieldLabel}>
        عکس پرسنلی
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (
              file &&
              (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                file.size > 5 * 1024 * 1024)
            ) {
              setPhotoError(
                'عکس باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.',
              );
              event.target.value = '';
              return;
            }
            setPhotoError('');
            onPhoto(file);
          }}
        />
        {photo?.name}
        {photo ? (
          <button
            type="button"
            onClick={() => {
              onPhoto(undefined);
              if (photoInput.current) photoInput.current.value = '';
            }}
          >
            حذف عکس انتخاب‌شده
          </button>
        ) : null}
        {photoError ? <small role="alert">{photoError}</small> : null}
      </label>
      {photo ? (
        <label className={styles.fieldLabel}>
          اعتبار عکس در بایگانی
          <DatePicker
            value={photoValidUntil ?? ''}
            onChange={onPhotoValidUntil}
            aria-label="اعتبار عکس در بایگانی"
            required
          />
          {photoValidityError ? (
            <small role="alert" className={styles.fieldError}>
              {photoValidityError}
            </small>
          ) : null}
        </label>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir="rtl"
          className={`${styles.modal} ${styles.contactsModal}`}
        >
          <DialogTitle>شماره‌های تماس</DialogTitle>
          <div className={styles.contactFields}>
            <label className={styles.fieldLabel}>
              نوع شماره تماس
              <NativeSearchSelect
                value={phone[0] ?? ''}
                onChange={(event) =>
                  setPhone([event.target.value, phone[1] ?? ''])
                }
              >
                {HR_RADAN_COMPLETION_OPTIONS['نوع شماره تماس']!.map(
                  (option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ),
                )}
              </NativeSearchSelect>
            </label>
            <label className={styles.fieldLabel}>
              شماره تماس
              <input
                className={styles.control}
                value={phone[1] ?? ''}
                type="tel"
                dir="ltr"
                aria-invalid={Boolean(phoneError)}
                inputMode="tel"
                maxLength={30}
                onChange={(event) =>
                  setPhone([phone[0] ?? 'موبایل', event.target.value])
                }
              />
            </label>
          </div>
          <button
            className={buttonVariants({ variant: 'outline' })}
            type="button"
            onClick={() => {
              const error = personnelContactError(phone, draft);
              setPhoneError(error);
              if (!error) {
                setDraft([...draft, phone.map((v) => v.trim())]);
                setPhone([phone[0] ?? 'موبایل', '']);
              }
            }}
          >
            افزودن شماره تماس
          </button>
          {phoneError ? (
            <p className={styles.fieldError} role="alert">
              {phoneError}
            </p>
          ) : null}
          <ul className={styles.contactList}>
            {draft.map((p, i) => (
              <li key={i}>
                <span className={styles.contactType}>{p[0]}</span>
                <bdi className={styles.contactNumber}>{p[1]}</bdi>
                <button
                  className={buttonVariants({ variant: 'ghost' })}
                  type="button"
                  aria-label={`حذف شماره تماس ${i + 1}`}
                  onClick={() => setDraft(draft.filter((_, j) => i !== j))}
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.modalFooter}>
            <button
              className={buttonVariants({ variant: 'outline' })}
              type="button"
              onClick={() => setOpen(false)}
            >
              لغو
            </button>
            <button
              className={buttonVariants({ variant: 'primary' })}
              type="button"
              onClick={() => {
                onContacts(draft);
                setOpen(false);
              }}
            >
              تایید
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
