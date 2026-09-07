'use client';
import { useRef, useState } from 'react';
import type {
  MasterDataResource,
  SalesContractOutputV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { masterDataApi } from '@/modules/master-data/api/client';
import { legalEntityBrand } from '@/modules/legal-entities/model/context';
import { salesApi } from '../api/client';
import {
  contractPrintHtml,
  type ContractPrintReferences,
} from '../model/contract-print';

export async function loadContractPrint(id: string) {
  const { data: output } = await salesApi.output(id);
  const c = output.contract;
  const keys: [MasterDataResource, string][] = [
    ['cities', c.originId],
    ['cities', c.destinationId],
  ];
  if (c.hotelSelection?.roomTypeId)
    keys.push(['room-types', c.hotelSelection.roomTypeId]);
  if (c.hotelSelection?.mealServiceId)
    keys.push(['meal-services', c.hotelSelection.mealServiceId]);
  if (c.hotelSelection?.hotelId)
    keys.push(['hotels', c.hotelSelection.hotelId]);
  const refs: ContractPrintReferences = { names: {} };
  const warnings: string[] = [];
  await Promise.all(
    keys.map(async ([resource, key]) => {
      try {
        const { data } = await masterDataApi.detail(resource, key);
        refs.names[key] = data.name;
        if (resource === 'hotels' && data.attributes.starRating != null)
          refs.hotelGrade = String(data.attributes.starRating);
      } catch {
        warnings.push('نام مرجع ' + resource + ' در دسترس نیست.');
      }
    }),
  );
  try {
    const response = await fetch(legalEntityBrand(output.company.code).src, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('logo');
    const blob = await response.blob();
    refs.logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    warnings.push('لوگوی شرکت بارگذاری نشد.');
  }
  return { output, html: contractPrintHtml(output, refs), warnings };
}

export function ContractOutputButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [html, setHtml] = useState('');
  const [output, setOutput] = useState<SalesContractOutputV1 | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const request = useRef(0);
  async function load() {
    const version = ++request.current;
    setOpen(true);
    setBusy(true);
    setReady(false);
    setError('');
    setHtml('');
    setOutput(null);
    try {
      const result = await loadContractPrint(contractId);
      if (version !== request.current) return;
      setOutput(result.output);
      setHtml(result.html);
      setWarnings(result.warnings);
    } catch (reason) {
      if (version === request.current)
        setError(
          reason instanceof Error ? reason.message : 'دریافت خروجی ناموفق بود.',
        );
    } finally {
      if (version === request.current) setBusy(false);
    }
  }
  async function print() {
    const win = frame.current?.contentWindow;
    if (!win) return;
    setError('');
    try {
      const faces = await win.document.fonts.load('16px ContractNazanin');
      if (!faces.length || !win.document.fonts.check('16px ContractNazanin'))
        throw new Error(
          'فونت ب‌نازنین روی این دستگاه در دسترس نیست؛ پیش از ذخیره PDF آن را نصب کنید.',
        );
      await Promise.all(
        Array.from(win.document.images).map((img) => img.decode()),
      );
      win.focus();
      win.print();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'چاپ ناموفق بود.');
    }
  }
  async function download() {
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(
        '/sales/contracts/' + encodeURIComponent(contractId) + '/pdf',
        { credentials: 'include', cache: 'no-store' },
      );
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/pdf')
      ) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          body?.message ??
            'دریافت PDF ناموفق بود؛ ورود به حساب و دسترسی را بررسی کنید.',
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contract-' + contractId + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دانلود ناموفق بود.');
    } finally {
      setDownloading(false);
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void load()}>
        خروجی قرارداد / PDF
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            request.current++;
            setHtml('');
            setOutput(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[94vh] max-w-5xl flex-col gap-3 overflow-hidden">
          <DialogTitle>خروجی قرارداد برای مشتری</DialogTitle>
          <DialogDescription>
            مبلغ‌ها از قرارداد ثبت‌شده خوانده می‌شوند. فایل PDF را مستقیم دانلود
            کنید یا نسخه را چاپ کنید. این نسخه رسید پرداخت یا فاکتور رسمی
            مالیاتی نیست.
          </DialogDescription>
          {output && (
            <p className="text-sm">
              شرکت فعال برای این نسخه:{' '}
              <strong>{output.company.persianName}</strong> · قرارداد{' '}
              <bdi>{output.contract.contractNumber}</bdi>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            شرکت این نسخه، شرکت فعال هنگام تهیه خروجی است. این برگه رسید پرداخت یا تأیید نهایی خدمات رزرواسیون نیست؛ صدور رسمی نسخهٔ بایگانی‌شده جداگانه انجام می‌شود.
          </p>
          <p className="text-xs text-muted-foreground">
            برای چاپ بدون آدرس سایت و تاریخ مرورگر، در More settings گزینهٔ Headers and footers را خاموش کنید؛ فایل «دانلود PDF» این موارد را ندارد.
          </p>
          {busy && <p role="status">دریافت اطلاعات قرارداد…</p>}
          {warnings.length > 0 && html && (
            <p className="text-xs text-amber-700">
              {warnings.join(' ')} برای اطلاعات ناموجود عدد یا نام فرضی درج
              نمی‌شود.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {html && (
            <iframe
              ref={frame}
              title="پیش‌نمایش قرارداد ثبت‌شده"
              sandbox="allow-same-origin allow-modals"
              srcDoc={html}
              onLoad={() => setReady(true)}
              className="min-h-0 w-full flex-1 rounded-xl border bg-muted"
              style={{ height: '60vh', minHeight: 260 }}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!html || busy || !ready}
              onClick={() => void print()}
            >
              چاپ
            </Button>
            <Button
              disabled={!output || busy || downloading}
              onClick={() => void download()}
            >
              {downloading ? 'در حال ساخت PDF…' : 'دانلود PDF'}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load()}
            >
              دریافت آخرین اطلاعات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
