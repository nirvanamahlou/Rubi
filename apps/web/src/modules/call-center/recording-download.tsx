'use client';
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useDisplayLanguage } from '@/i18n/locale-context';
import {
  callRecordings,
  recordingBlob,
  RecordingError,
  type CallRecording,
} from './recording-client';
import styles from './workspace.module.css';

export function RecordingDownload({
  callId,
  branchId,
  allowed,
}: {
  callId: string;
  branchId: string;
  allowed: boolean;
}) {
  const english = useDisplayLanguage() === 'en';
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<CallRecording[]>([]);
  const [message, setMessage] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [callId, branchId, allowed]);
  const label = english ? 'Download audio file' : 'دانلود فایل صوتی';
  async function download(id?: string) {
    if (!allowed || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage('');
    try {
      let selected = id;
      if (!selected) {
        const rows = await callRecordings(callId, branchId, controller.signal);
        if (controller.signal.aborted) return;
        setFiles(rows);
        if (!rows.length) {
          setMessage(
            english
              ? 'No audio file is available for this call yet.'
              : 'فایل صوتی این تماس هنوز در دسترس نیست.',
          );
          return;
        }
        if (rows.length > 1) {
          setMessage(
            english
              ? 'Select a recording to download.'
              : 'فایل صوتی موردنظر را برای دانلود انتخاب کنید.',
          );
          return;
        }
        selected = rows[0]!.id;
      }
      const blob = await recordingBlob(
        callId,
        selected,
        branchId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `recording-${selected}.wav`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof RecordingError && [401, 403].includes(error.status)
            ? english
              ? 'You do not have access to this recording. Check your sign-in and permissions.'
              : 'دسترسی به صوت ندارید؛ ورود و مجوز حساب را بررسی کنید.'
            : error instanceof RecordingError && error.status === 404
              ? english
                ? 'This recording is unavailable or has expired.'
                : 'فایل صوتی در دسترس نیست یا مهلت نگهداری آن تمام شده است.'
              : english
                ? 'Download failed. Please try again.'
                : 'دانلود انجام نشد. دوباره تلاش کنید.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }
  return (
    <div dir={english ? 'ltr' : 'rtl'} style={{ marginBlockStart: 8 }}>
      <button
        type="button"
        className={styles.secondary}
        disabled={!allowed || busy}
        aria-busy={busy}
        onClick={() => void download()}
      >
        <span>
          {busy
            ? english
              ? 'Preparing download…'
              : 'در حال آماده‌سازی دانلود…'
            : label}
        </span>
        <Download size={16} aria-hidden="true" />
      </button>
      {!allowed && (
        <p>
          {english
            ? 'Audio download permission is required.'
            : 'برای دانلود صوت، مجوز دسترسی به فایل صوتی لازم است.'}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {files.length > 1 && (
        <ul aria-label={english ? 'Call recordings' : 'فایل‌های صوتی تماس'}>
          {files.map((file, index) => (
            <li key={file.id}>
              <button
                type="button"
                className={styles.secondary}
                disabled={busy || !allowed}
                onClick={() => void download(file.id)}
              >
                <span>
                  {english
                    ? `Audio file ${index + 1}`
                    : `فایل صوتی ${(index + 1).toLocaleString('fa-IR')}`}
                </span>
                <Download size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
