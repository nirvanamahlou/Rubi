'use client';
import {
  canSelfServeSalesContract,
  hasSalesContractSelfService,
} from '@nora/contracts';
import {
  useAccessActor,
  useAccessPermissions,
} from '@/modules/iam/access-context';
import { readPublicDocumentLink } from '@/modules/travel-documents/public/use-public-document-link';
import { readContractFlightFacts } from '../model/contract-flight-facts';
import { enrichContractHotels } from '../model/contract-hotel-references';
import { downloadContractResponse } from '../model/contract-download';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { useRef, useState } from 'react';
import type {
  MasterDataResource,
  SalesContractOutputV1,
} from '@nora/contracts';
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
import { printCityInternational } from '../model/contract-print-country';
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
  for (const stay of c.hotelSelection?.additionalStays ?? [])
    keys.push(['cities', stay.cityId]);
  const refs: ContractPrintReferences = { names: {} };
  const warnings: string[] = [];
  const base = getPublicApiBaseUrl();
  if (base)
    refs.flightFacts = await readContractFlightFacts(output, (path) =>
      localizedFetch(base + path, {
        credentials: 'include',
        cache: 'no-store',
      }),
    );
  await Promise.all(
    keys.map(async ([resource, key]) => {
      try {
        const { data } = await masterDataApi.detail(resource, key, 'sales');
        refs.names[key] = data.name;
        if (
          resource === 'cities' &&
          (await printCityInternational(
            data,
            async (id) =>
              (await masterDataApi.detail('countries', id, 'sales')).data,
          ))
        )
          refs.international = true;
        if (resource === 'hotels' && data.attributes.starRating != null)
          refs.hotelGrade = String(data.attributes.starRating);
        if (resource === 'hotels') {
          if (typeof data.attributes.englishName === 'string')
            refs.hotelLatinName = data.attributes.englishName.trim();
          if (typeof data.attributes.website === 'string')
            refs.hotelWebsite = data.attributes.website.trim();
        }
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
  await enrichContractHotels(
    output,
    refs,
    async (resource, id) =>
      (await masterDataApi.detail(resource, id, 'sales')).data,
  );
  const shared = await readPublicDocumentLink(
    '/sales/contracts/' + encodeURIComponent(id) + '/pdf?format=share',
  );
  if (shared.status === 'ready') return { output, html: shared.html, warnings };
  return { output, html: contractPrintHtml(output, refs), warnings };
}

export function ContractOutputButton({
  contractId,
  ownerUserId,
  branchId,
  className,
  label = 'قرارداد',
}: {
  contractId: string;
  ownerUserId?: string;
  branchId?: string;
  className?: string;
  label?: string;
}) {
  const permissions = useAccessPermissions();
  const actor = useAccessActor();
  const selfService =
    ownerUserId && branchId
      ? Boolean(
          actor && canSelfServeSalesContract(actor, { ownerUserId, branchId }),
        )
      : hasSalesContractSelfService(permissions ?? []);
  const scopedReader =
    permissions?.includes('sales.contracts.read.all') ||
    (ownerUserId && branchId
      ? actor?.branchIds.includes(branchId) &&
        (permissions?.includes('sales.contracts.read.branch') ||
          (actor.userId === ownerUserId &&
            permissions?.includes('sales.contracts.read.own')))
      : ['own', 'branch'].some((scope) =>
          permissions?.includes('sales.contracts.read.' + scope),
        ));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [html, setHtml] = useState('');
  const [output, setOutput] = useState<SalesContractOutputV1 | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const request = useRef(0);
  async function load() {
    const version = ++request.current;
    setOpen(true);
    setBusy(true);
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
  async function download() {
    setDownloading(true);
    setError('');
    try {
      const response = await downloadContractResponse(contractId);
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
      <Button
        {...(selfService || scopedReader ? {} : { permission: 'sales.export' })}
        size="sm"
        variant="outline"
        className={className}
        onClick={() => void load()}
      >
        {label}
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
            کنید. این نسخه رسید پرداخت یا فاکتور رسمی مالیاتی نیست.
          </DialogDescription>
          {output && (
            <p className="text-sm">
              شرکت فعال برای این نسخه:{' '}
              <strong>{output.company.persianName}</strong> · قرارداد{' '}
              <bdi>{output.contract.contractNumber}</bdi>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            شرکت این نسخه، شرکت فعال هنگام تهیه خروجی است. این برگه رسید پرداخت
            یا تأیید نهایی خدمات رزرواسیون نیست؛ صدور رسمی نسخهٔ بایگانی‌شده
            جداگانه انجام می‌شود.
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
              title="پیش‌نمایش قرارداد ثبت‌شده"
              sandbox="allow-same-origin allow-modals"
              srcDoc={html}
              className="min-h-0 w-full flex-1 rounded-xl border bg-muted"
              style={{ height: '60vh', minHeight: 260 }}
            />
          )}
          <div className="flex flex-wrap gap-2">
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
