'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Save, Trash2, UserRound } from 'lucide-react';
import { Alert, Button, Card, Input } from '@/components/ui';
import {
  personalDetailsError,
  profilePhotoError,
  PROFILE_PHOTO_MAX_BYTES,
  type PersonalDetails,
} from '../model/personal-details';

export function PersonalDetailsForm({
  initial,
  username,
  onSave,
}: {
  initial: PersonalDetails;
  username: string;
  onSave?: (details: PersonalDetails, photo: File | null) => Promise<void>;
}) {
  const [details, setDetails] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const selection = useRef(0);
  const saving = useRef(false);
  const upload = useRef<HTMLInputElement>(null);
  const photoUrl = useRef('');

  useEffect(
    () => () => {
      selection.current++;
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    },
    [],
  );

  function clearPhoto() {
    selection.current++;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = '';
    setReadingPhoto(false);
    setPhoto(null);
    setPreview('');
    setSaved(false);
  }

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
    const current = ++selection.current;
    setReadingPhoto(true);
    setError('');
    setSaved(false);
    try {
      if (file.size > PROFILE_PHOTO_MAX_BYTES)
        throw new Error('حداکثر حجم عکس ۵ مگابایت است.');
      const invalid = profilePhotoError(
        file,
        new Uint8Array(await file.slice(0, 16).arrayBuffer()),
      );
      if (invalid) throw new Error(invalid);
      const bitmap = await createImageBitmap(file);
      const validDimensions =
        bitmap.width > 0 &&
        bitmap.height > 0 &&
        bitmap.width <= 8192 &&
        bitmap.height <= 8192;
      bitmap.close();
      if (!validDimensions)
        throw new Error('ابعاد عکس باید حداکثر ۸۱۹۲ در ۸۱۹۲ پیکسل باشد.');
      if (current === selection.current) {
        if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
        photoUrl.current = URL.createObjectURL(file);
        setPreview(photoUrl.current);
        setPhoto(file);
      }
    } catch (reason) {
      if (current === selection.current)
        setError(
          reason instanceof Error ? reason.message : 'عکس قابل خواندن نیست.',
        );
    } finally {
      if (current === selection.current) setReadingPhoto(false);
    }
  }

  function update(field: keyof PersonalDetails, value: string) {
    setDetails((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSave || saving.current || readingPhoto) return;
    const invalid = personalDetailsError(details);
    if (invalid) {
      setError(invalid);
      return;
    }
    saving.current = true;
    setPending(true);
    setError('');
    setSaved(false);
    try {
      await onSave(
        {
          displayName: details.displayName.trim(),
          email: details.email.trim(),
          phone: details.phone.trim(),
        },
        photo,
      );
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'ذخیره اطلاعات انجام نشد؛ دوباره تلاش کنید.',
      );
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-black">اطلاعات شخصی</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        اطلاعات تماس و عکس پروفایل خود را وارد یا ویرایش کنید.
      </p>
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-5">
        <fieldset disabled={pending} className="space-y-5">
          <legend className="sr-only">ویرایش اطلاعات شخصی</legend>
          <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">
              {photo && preview ? (
                // A local object URL is revoked when the selected preview changes.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="پیش‌نمایش عکس پروفایل انتخاب‌شده"
                  className="size-full object-cover"
                />
              ) : (
                <UserRound aria-hidden="true" className="size-10" />
              )}
            </div>
            <div className="space-y-2">
              <p className="font-bold">عکس پروفایل</p>
              <p className="text-xs text-muted-foreground">
                PNG، JPG یا WebP؛ حداکثر ۵ مگابایت
              </p>
              <input
                ref={upload}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="انتخاب عکس پروفایل"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void selectPhoto(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => upload.current?.click()}
                  className="justify-center text-center"
                >
                  <Camera aria-hidden="true" className="size-4" />
                  {readingPhoto
                    ? 'بررسی عکس…'
                    : photo
                      ? 'تعویض عکس'
                      : 'انتخاب عکس'}
                </Button>
                {photo ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-center text-center"
                    onClick={clearPhoto}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    حذف عکس انتخاب‌شده
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              className="space-y-2 text-sm font-bold"
              htmlFor="personal-name"
            >
              <span>نام و نام خانوادگی *</span>
              <Input
                id="personal-name"
                autoComplete="name"
                required
                maxLength={160}
                value={details.displayName}
                onChange={(event) => update('displayName', event.target.value)}
              />
            </label>
            <label
              className="space-y-2 text-sm font-bold"
              htmlFor="personal-username"
            >
              <span>نام کاربری</span>
              <Input
                id="personal-username"
                dir="ltr"
                value={username}
                readOnly
                className="bg-muted/50"
              />
              <span className="block text-xs font-normal text-muted-foreground">
                نام کاربری توسط مدیر سامانه تعیین می‌شود.
              </span>
            </label>
            <label
              className="space-y-2 text-sm font-bold"
              htmlFor="personal-email"
            >
              <span>ایمیل</span>
              <Input
                id="personal-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                maxLength={320}
                value={details.email}
                onChange={(event) => update('email', event.target.value)}
              />
            </label>
            <label
              className="space-y-2 text-sm font-bold"
              htmlFor="personal-phone"
            >
              <span>شماره تماس</span>
              <Input
                id="personal-phone"
                type="tel"
                dir="ltr"
                autoComplete="tel"
                maxLength={32}
                value={details.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
            </label>
          </div>
        </fieldset>
        {!onSave ? (
          <Alert
            title="تغییرات هنوز ذخیره نمی‌شوند"
            description="اتصال ذخیره اطلاعات و عکس حساب هنوز فعال نشده است. تغییرات این فرم با خروج از صفحه از بین می‌روند."
          />
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p
            role="status"
            className="text-sm text-emerald-700 dark:text-emerald-400"
          >
            اطلاعات شخصی ذخیره شد.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={!onSave || pending || readingPhoto}
            className="min-w-40 justify-center text-center"
          >
            <Save aria-hidden="true" className="size-4" />
            {pending ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="justify-center text-center"
            onClick={() => {
              clearPhoto();
              setDetails(initial);
              setError('');
            }}
          >
            بازنشانی فرم
          </Button>
        </div>
      </form>
    </Card>
  );
}
