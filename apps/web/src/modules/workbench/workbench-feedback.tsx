'use client';
import { useRef, useState } from 'react';
import { MessageSquareText, Paperclip, Send, X } from 'lucide-react';
import type { WorkbenchFeedbackDepartment } from '@rubi/contracts';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Textarea,
} from '@/components/ui';
import { WorkbenchSelect } from './workbench-select';
import { messageUnits } from './message-templates';
import {
  uploadWorkbenchFeedbackFiles,
  workbenchFeedbackApi,
} from './workbench-feedback-api';

export function WorkbenchFeedback({
  branchId,
}: {
  branchId?: string | undefined;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [department, setDepartment] =
    useState<WorkbenchFeedbackDepartment>('management');
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const submissionId = useRef<string>('');
  const picker = useRef<HTMLInputElement>(null);
  const reset = () => {
    setSubject('');
    setBody('');
    setDepartment('management');
    setAnonymous(false);
    setFiles([]);
    setError('');
    setSuccess('');
    submissionId.current = '';
    if (picker.current) picker.current.value = '';
  };
  return (
    <Card
      id="workbench-feedback"
      className="space-y-4 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 dark:border-violet-400/25 dark:from-violet-950/50 dark:to-indigo-950/40"
    >
      <div className="flex items-center gap-2">
        <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
        <h2 className="font-bold">نظرسنجی و پیشنهادها</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        نظر، پیشنهاد یا موضوع موردنظر خود را برای واحد مربوط آماده کنید.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const normalizedSubject = subject.trim();
          const normalizedBody = body.trim();
          if (!branchId) {
            setError('برای ارسال نظرسنجی باید یک شعبه مجاز داشته باشید.');
            return;
          }
          if (!normalizedSubject || !normalizedBody) {
            setError('موضوع و متن نظرسنجی را وارد کنید.');
            return;
          }
          setSending(true);
          setError('');
          setSuccess('');
          try {
            const id = submissionId.current || crypto.randomUUID();
            submissionId.current = id;
            const attachmentDocumentIds = await uploadWorkbenchFeedbackFiles({
              feedbackId: id,
              subject: normalizedSubject,
              branchId,
              anonymous,
              files,
            });
            const result = await workbenchFeedbackApi.send({
              id,
              branchId,
              department,
              subject: normalizedSubject,
              body: normalizedBody,
              anonymous,
              attachmentDocumentIds,
            });
            reset();
            setSuccess(
              `نظر شما ثبت و برای واحد مقصد ارسال شد. کد پیگیری: ${result.data.trackingNumber}`,
            );
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : 'ارسال نظرسنجی انجام نشد.',
            );
          } finally {
            setSending(false);
          }
        }}
      >
        <label className="block space-y-2 text-sm font-semibold">
          <span>موضوع *</span>
          <Input
            required
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="موضوع نظر یا پیشنهاد"
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>واحد یا دپارتمان مقصد *</span>
          <WorkbenchSelect
            label="واحد مقصد نظرسنجی"
            required
            value={department}
            onValueChange={(value) =>
              setDepartment(value as WorkbenchFeedbackDepartment)
            }
            options={messageUnits
              .filter((unit) => unit.id !== 'ai')
              .map((unit) => ({ value: unit.id, label: unit.label }))}
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>متن *</span>
          <Textarea
            required
            maxLength={10000}
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="نظر، پیشنهاد یا توضیحات خود را بنویسید…"
          />
        </label>
        <div className="space-y-2">
          <label
            htmlFor="workbench-feedback-files"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Paperclip className="size-4" aria-hidden="true" />
            فایل پیوست — اختیاری
          </label>
          <Input
            ref={picker}
            id="workbench-feedback-files"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (
                files.length + selected.length > 10 ||
                selected.some(
                  (file) =>
                    file.size > 10 * 1024 * 1024 ||
                    !/\.(pdf|png|jpe?g)$/i.test(file.name),
                )
              ) {
                setError(
                  'حداکثر ۱۰ فایل PDF یا تصویر، هر فایل تا ۱۰ مگابایت انتخاب کنید.',
                );
                return;
              }
              setFiles((current) => [...current, ...selected]);
              setError('');
              setSuccess('');
            }}
          />
          <p className="text-xs text-muted-foreground">
            PDF یا تصویر؛ حداکثر ۱۰ فایل، هر فایل تا ۱۰ مگابایت. پیوست‌ها در
            «اسناد و فایل‌ها» نیز ذخیره می‌شوند.
          </p>
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-sm"
              >
                <span className="min-w-0 break-all">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`حذف فایل ${file.name}`}
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                  حذف
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 rounded-xl border border-border p-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <Checkbox
              checked={anonymous}
              onCheckedChange={(checked) => setAnonymous(checked === true)}
            />
            ارسال ناشناس
          </label>
          <p className="text-xs leading-6 text-muted-foreground">
            {anonymous
              ? 'نام شما در اعلان ارسالی به واحد گیرنده نمایش داده نمی‌شود.'
              : 'نام شما همراه نظر به واحد گیرنده نمایش داده می‌شود.'}
          </p>
          {anonymous && files.length > 0 && (
            <p className="text-xs leading-6 text-muted-foreground">
              نام فایل یا محتوای پیوست ممکن است هویت شما را مشخص کند.
            </p>
          )}
        </div>
        {error && <Alert tone="error" title={error} />}
        {success && <Alert title={success} />}
        <div className="flex flex-wrap gap-2">
          <Button disabled={sending || !branchId} type="submit">
            <Send className="size-4" aria-hidden="true" />
            {sending
              ? 'در حال ارسال…'
              : anonymous
                ? 'ارسال ناشناس'
                : 'ارسال نظر'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={reset}
          >
            پاک‌کردن فرم
          </Button>
        </div>
      </form>
    </Card>
  );
}
