'use client';

import type {
  AuthenticatedActor,
  CustomerAffairsMarketingIntakeViewV1,
  MarketingAssetKind,
  MarketingAssetViewV1,
  MarketingCampaignViewV1,
} from '@nora/contracts';
import { Eye, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import { Badge, Card, EmptyState } from '@/components/ui/surfaces';
import { marketingApi } from '../api/records-client';

type Notice = (message: string) => void;

function useMarketingData(kinds: MarketingAssetKind[] = []) {
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [campaigns, setCampaigns] = useState<MarketingCampaignViewV1[]>([]);
  const [assets, setAssets] = useState<MarketingAssetViewV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = kinds.join(',');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [access, campaignResponse, ...assetResponses] = await Promise.all([
        marketingApi.access(),
        marketingApi.campaigns(),
        ...(key ? key.split(',') : []).map((kind) =>
          marketingApi.assets(kind as MarketingAssetKind),
        ),
      ]);
      setActor(access);
      setCampaigns(campaignResponse.data);
      setAssets(assetResponses.flatMap((response) => response.data));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت داده انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, [key]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return { actor, campaigns, assets, loading, error, load };
}

function LoadState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <Card className="p-6 text-center" role="status">
        در حال دریافت رکوردها…
      </Card>
    );
  if (!error) return null;
  return (
    <Card className="grid gap-3 p-6 text-center" role="alert">
      <p>{error}</p>
      <Button
        className="justify-self-center"
        onClick={onRetry}
        variant="outline"
      >
        تلاش دوباره
      </Button>
    </Card>
  );
}

function AssetActions({
  item,
  onDelete,
  onEdit,
  onView,
}: {
  item: MarketingAssetViewV1;
  onDelete: () => void;
  onEdit: () => void;
  onView: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        aria-label={`مشاهده ${item.name}`}
        onClick={onView}
        size="icon"
        title="مشاهده"
        variant="outline"
      >
        <Eye aria-hidden="true" className="size-4" />
      </Button>
      <Button
        aria-label={`ویرایش ${item.name}`}
        onClick={onEdit}
        size="icon"
        title="ویرایش"
        variant="outline"
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Button>
      <Button
        aria-label={`حذف ${item.name}`}
        onClick={onDelete}
        size="icon"
        title="حذف"
        variant="destructive"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

export function DurableSegmentsPanel({ onNotice }: { onNotice: Notice }) {
  const data = useMarketingData(['SEGMENT']);
  const [name, setName] = useState('');
  const [rule, setRule] = useState('');
  const [editing, setEditing] = useState<MarketingAssetViewV1 | null>(null);
  const [viewing, setViewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!data.actor?.branchIds[0] || name.trim().length < 2 || !rule.trim())
      return;
    setSaving(true);
    try {
      await marketingApi.saveAsset(
        {
          kind: 'SEGMENT',
          name: name.trim(),
          status: 'ACTIVE',
          payload: { rules: [{ expression: rule.trim() }] },
          ...(editing ? { expectedVersion: editing.version } : {}),
        },
        {
          ...(editing ? { id: editing.id } : {}),
          branchId: data.actor.branchIds[0],
        },
      );
      onNotice('سگمنت نام‌دار با قواعد نسخه‌دار ذخیره شد.');
      setName('');
      setRule('');
      setEditing(null);
      setViewing(false);
      await data.load();
    } catch (reason) {
      onNotice(
        reason instanceof Error ? reason.message : 'ذخیره سگمنت انجام نشد.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="grid gap-4">
      <LoadState
        error={data.error}
        loading={data.loading}
        onRetry={() => void data.load()}
      />
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <FormField id="durable-segment-name" label="نام سگمنت" required>
          <Input
            disabled={viewing}
            id="durable-segment-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField id="durable-segment-rule" label="قاعده سگمنت" required>
          <Input
            disabled={viewing}
            id="durable-segment-rule"
            value={rule}
            onChange={(event) => setRule(event.target.value)}
          />
        </FormField>
        <div className="flex gap-2 md:col-span-2">
          {!viewing ? (
            <Button disabled={saving} onClick={() => void save()}>
              <Save aria-hidden="true" className="size-4" />
              {saving ? 'در حال ذخیره…' : 'ذخیره سگمنت'}
            </Button>
          ) : null}
          {editing || viewing ? (
            <Button
              onClick={() => {
                setEditing(null);
                setViewing(false);
                setName('');
                setRule('');
              }}
              variant="outline"
            >
              <X aria-hidden="true" className="size-4" />
              بستن
            </Button>
          ) : null}
        </div>
      </Card>
      <AssetTable
        items={data.assets}
        onDelete={async (item) => {
          try {
            await marketingApi.deleteAsset(item.id, item.version);
            await data.load();
            onNotice('سگمنت حذف شد.');
          } catch (reason) {
            onNotice(
              reason instanceof Error ? reason.message : 'حذف انجام نشد.',
            );
          }
        }}
        onSelect={(item, mode) => {
          setEditing(mode === 'edit' ? item : null);
          setViewing(mode === 'view');
          setName(item.name);
          const rules = item.payload.rules as
            Array<{ expression?: string }> | undefined;
          setRule(rules?.[0]?.expression ?? '');
        }}
      />
    </section>
  );
}

function AssetTable({
  items,
  onDelete,
  onSelect,
}: {
  items: MarketingAssetViewV1[];
  onDelete: (item: MarketingAssetViewV1) => void;
  onSelect: (item: MarketingAssetViewV1, mode: 'view' | 'edit') => void;
}) {
  if (!items.length)
    return (
      <EmptyState
        title="هنوز رکوردی ذخیره نشده است"
        description="فرم بالا را تکمیل و ذخیره کنید."
      />
    );
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-start">نام</th>
            <th className="p-3 text-start">نوع</th>
            <th className="p-3 text-start">وضعیت</th>
            <th className="p-3 text-start">نسخه</th>
            <th className="p-3 text-start">عملیات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="border-t border-border" key={item.id}>
              <td className="p-3 font-bold">{item.name}</td>
              <td className="p-3">{item.kind}</td>
              <td className="p-3">
                <Badge>{item.status}</Badge>
              </td>
              <td className="p-3">{item.version.toLocaleString('fa-IR')}</td>
              <td className="p-3">
                <AssetActions
                  item={item}
                  onDelete={() => onDelete(item)}
                  onEdit={() => onSelect(item, 'edit')}
                  onView={() => onSelect(item, 'view')}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function DurableIntakesPanel({
  mode,
  onNotice,
}: {
  mode: 'leads' | 'scoring';
  onNotice: Notice;
}) {
  const data = useMarketingData();
  const [items, setItems] = useState<CustomerAffairsMarketingIntakeViewV1[]>(
    [],
  );
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('WEBSITE');
  const [campaignId, setCampaignId] = useState('none');
  const [status, setStatus] = useState('NEW');
  const [lastFollowUpAt, setLastFollowUpAt] = useState('');
  const [ruleIds, setRuleIds] = useState<string[]>(['PHONE_VALID']);
  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await marketingApi.intakes()).data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت سرنخ‌ها انجام نشد.',
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const toggleRule = (rule: string, checked: boolean) =>
    setRuleIds((current) =>
      checked
        ? [...new Set([...current, rule])]
        : current.filter((item) => item !== rule),
    );
  return (
    <section className="grid gap-4">
      <LoadState
        error={data.error || error}
        loading={data.loading}
        onRetry={() => {
          void data.load();
          void load();
        }}
      />
      {mode === 'leads' ? (
        <Card className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <FormField id="intake-phone" label="تلفن" required>
            <Input
              dir="ltr"
              id="intake-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </FormField>
          <FormField id="intake-source" label="منبع ورود" required>
            <Input
              id="intake-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </FormField>
          <FormField id="intake-campaign" label="کمپین">
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger id="intake-campaign">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون کمپین</SelectItem>
                {data.campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="intake-status" label="وضعیت" required>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="intake-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['NEW', 'CONTACTED', 'QUALIFIED', 'NURTURE', 'LOST'].map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            description="فعلاً به کاربر جاری محدود است؛ انتخاب کارشناس دیگر به قرارداد عمومی IAM نیاز دارد."
            id="intake-assignee"
            label="کارشناس فروش"
          >
            <Input
              dir="ltr"
              id="intake-assignee"
              readOnly
              value={data.actor?.userId ?? ''}
            />
          </FormField>
          <FormField id="intake-follow-up" label="آخرین پیگیری">
            <DatePicker
              id="intake-follow-up"
              includeTime
              value={lastFollowUpAt}
              onChange={setLastFollowUpAt}
            />
          </FormField>
          <Button
            className="md:col-span-2 xl:col-span-3"
            onClick={async () => {
              if (!data.actor?.branchIds[0]) return;
              try {
                await marketingApi.createIntake(
                  {
                    phone,
                    sourceCategory: source,
                    campaignId: campaignId === 'none' ? null : campaignId,
                    status: status as 'NEW',
                    assigneeUserId: data.actor.userId,
                    lastFollowUpAt: lastFollowUpAt
                      ? new Date(lastFollowUpAt).toISOString()
                      : null,
                  },
                  data.actor.branchIds[0],
                );
                setPhone('');
                await load();
                onNotice('سرنخ اولیه در مرز مالک امور مشتریان ذخیره شد.');
              } catch (reason) {
                onNotice(
                  reason instanceof Error
                    ? reason.message
                    : 'ذخیره سرنخ انجام نشد.',
                );
              }
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            سرنخ جدید
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            قواعد برقرار را انتخاب کنید؛ امتیاز فقط در سرور امور مشتریان محاسبه
            می‌شود.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              'PHONE_VALID',
              'CAMPAIGN_ATTRIBUTED',
              'ASSIGNED',
              'FOLLOWED_UP',
              'STATUS_QUALIFIED',
            ].map((rule) => (
              <label
                className="flex items-center gap-2 rounded-lg border p-3"
                key={rule}
              >
                <Checkbox
                  checked={ruleIds.includes(rule)}
                  onCheckedChange={(value) => toggleRule(rule, value === true)}
                />
                {rule}
              </label>
            ))}
          </div>
        </Card>
      )}
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card
              className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center"
              key={item.id}
            >
              <div>
                <small className="text-muted-foreground">تلفن محافظت‌شده</small>
                <strong className="block" dir="ltr">
                  {item.maskedPhone}
                </strong>
              </div>
              <div>
                <small className="text-muted-foreground">منبع / وضعیت</small>
                <strong className="block">
                  {item.sourceCategory} · {item.status}
                </strong>
              </div>
              <div>
                <small className="text-muted-foreground">امتیاز</small>
                <strong className="block text-2xl">
                  {item.score.toLocaleString('fa-IR')}
                </strong>
              </div>
              {mode === 'scoring' ? (
                <Button
                  onClick={async () => {
                    try {
                      await marketingApi.scoreIntake(
                        item.id,
                        ruleIds,
                        item.version,
                      );
                      await load();
                      onNotice('امتیاز سرور ذخیره شد.');
                    } catch (reason) {
                      onNotice(
                        reason instanceof Error
                          ? reason.message
                          : 'امتیازدهی انجام نشد.',
                      );
                    }
                  }}
                >
                  محاسبه امتیاز
                </Button>
              ) : (
                <Badge>
                  {item.campaignId ? 'منتسب به کمپین' : 'بدون کمپین'}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="سرنخی ثبت نشده است"
          description="فرم سرنخ جدید را تکمیل کنید."
        />
      )}
    </section>
  );
}

export function DurableSourceChart({ onNotice }: { onNotice: Notice }) {
  const now = new Date();
  const local = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const [startsAt, setStartsAt] = useState(
    local(new Date(now.getFullYear(), now.getMonth(), 1)),
  );
  const [endsAt, setEndsAt] = useState(
    local(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  );
  const [counts, setCounts] = useState<
    Array<{ sourceCategory: string; count: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endExclusive = new Date(`${endsAt}T00:00:00`);
      endExclusive.setDate(endExclusive.getDate() + 1);
      const response = await marketingApi.sourceCounts(
        new Date(`${startsAt}T00:00:00`).toISOString(),
        endExclusive.toISOString(),
      );
      setCounts(response.counts);
    } catch (reason) {
      onNotice(
        reason instanceof Error ? reason.message : 'دریافت نمودار انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, [endsAt, onNotice, startsAt]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const max = Math.max(1, ...counts.map((item) => item.count));
  return (
    <section className="grid gap-4">
      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <FormField id="source-start" label="از تاریخ">
          <DatePicker
            id="source-start"
            value={startsAt}
            onChange={setStartsAt}
          />
        </FormField>
        <FormField id="source-end" label="تا تاریخ">
          <DatePicker id="source-end" value={endsAt} onChange={setEndsAt} />
        </FormField>
        <Button disabled={loading} onClick={() => void load()}>
          {loading ? 'در حال دریافت…' : 'اعمال بازه'}
        </Button>
      </Card>
      <Card className="min-h-96 p-6">
        <h3 className="font-black">تعداد واقعی سرنخ‌ها به تفکیک منبع</h3>
        {counts.length ? (
          <div className="mt-6 grid gap-4">
            {counts.map((item) => (
              <div
                className="grid gap-2 sm:grid-cols-[10rem_1fr_5rem] sm:items-center"
                key={item.sourceCategory}
              >
                <span>{item.sourceCategory}</span>
                <span className="h-8 overflow-hidden rounded-lg bg-muted">
                  <span
                    className="block h-full rounded-lg bg-primary"
                    style={{
                      width: `${Math.max(4, (item.count / max) * 100)}%`,
                    }}
                  />
                </span>
                <strong>{item.count.toLocaleString('fa-IR')}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="در این بازه سرنخی وجود ندارد"
            description="بازه دیگری را انتخاب کنید."
          />
        )}
      </Card>
    </section>
  );
}

export function DurableMessagesPanel({
  scheduled,
  onNotice,
}: {
  scheduled: boolean;
  onNotice: Notice;
}) {
  const data = useMarketingData(
    scheduled ? ['MESSAGE', 'SCHEDULE'] : ['MESSAGE'],
  );
  const messages = data.assets.filter((item) => item.kind === 'MESSAGE');
  const rows = data.assets.filter(
    (item) => item.kind === (scheduled ? 'SCHEDULE' : 'MESSAGE'),
  );
  const [editing, setEditing] = useState<MarketingAssetViewV1 | null>(null);
  const [viewing, setViewing] = useState(false);
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('none');
  const [messageId, setMessageId] = useState('none');
  const [channel, setChannel] = useState('SMS');
  const [status, setStatus] = useState('DRAFT');
  const [audience, setAudience] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const fill = (item: MarketingAssetViewV1, mode: 'view' | 'edit') => {
    setEditing(mode === 'edit' ? item : null);
    setViewing(mode === 'view');
    setName(item.name);
    setCampaignId(item.campaignId ?? 'none');
    setMessageId(item.relatedAssetId ?? 'none');
    setChannel(String(item.payload.channel ?? 'SMS'));
    setStatus(item.status);
    setAudience(String(item.payload.audience ?? ''));
    setBody(String(item.payload.body ?? ''));
    setScheduledAt(item.scheduledAt ?? '');
  };
  const save = async () => {
    if (!data.actor?.branchIds[0]) return;
    try {
      await marketingApi.saveAsset(
        {
          kind: scheduled ? 'SCHEDULE' : 'MESSAGE',
          name,
          status,
          campaignId: campaignId === 'none' ? null : campaignId,
          relatedAssetId: scheduled
            ? messageId === 'none'
              ? null
              : messageId
            : null,
          scheduledAt: scheduled ? new Date(scheduledAt).toISOString() : null,
          payload: scheduled
            ? { channel, status }
            : { channel, audience, body },
          ...(editing ? { expectedVersion: editing.version } : {}),
        },
        {
          ...(editing ? { id: editing.id } : {}),
          branchId: data.actor.branchIds[0],
        },
      );
      setEditing(null);
      setViewing(false);
      setName('');
      setBody('');
      await data.load();
      onNotice(
        scheduled
          ? 'ارسال زمان‌بندی‌شده ذخیره شد؛ Provider متصل نیست.'
          : 'پیام به‌صورت رکورد داخلی ذخیره شد؛ ارسال خارجی انجام نشد.',
      );
    } catch (reason) {
      onNotice(
        reason instanceof Error ? reason.message : 'ذخیره پیام انجام نشد.',
      );
    }
  };
  return (
    <section className="grid gap-4">
      <LoadState
        error={data.error}
        loading={data.loading}
        onRetry={() => void data.load()}
      />
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <FormField
          id="message-record-name"
          label={scheduled ? 'عنوان ارسال' : 'نام پیام'}
          required
        >
          <Input
            disabled={viewing}
            id="message-record-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        {scheduled ? (
          <FormField
            id="message-record-template"
            label="پیام ذخیره‌شده"
            required
          >
            <Select
              disabled={viewing}
              value={messageId}
              onValueChange={setMessageId}
            >
              <SelectTrigger id="message-record-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">انتخاب کنید</SelectItem>
                {messages.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        <FormField id="message-record-campaign" label="کمپین">
          <Select
            disabled={viewing}
            value={campaignId}
            onValueChange={setCampaignId}
          >
            <SelectTrigger id="message-record-campaign">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون کمپین</SelectItem>
              {data.campaigns.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="message-record-channel" label="کانال" required>
          <Select disabled={viewing} value={channel} onValueChange={setChannel}>
            <SelectTrigger id="message-record-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['SMS', 'EMAIL', 'WHATSAPP', 'PUSH_NOTIFICATION'].map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </FormField>
        {scheduled ? (
          <>
            <FormField id="message-record-time" label="زمان ارسال" required>
              <DatePicker
                id="message-record-time"
                includeTime
                readOnly={viewing}
                value={scheduledAt}
                onChange={setScheduledAt}
              />
            </FormField>
            <FormField id="message-record-status" label="وضعیت" required>
              <Select
                disabled={viewing}
                value={status}
                onValueChange={setStatus}
              >
                <SelectTrigger id="message-record-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['DRAFT', 'SCHEDULED', 'PAUSED', 'CANCELLED'].map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </FormField>
          </>
        ) : (
          <>
            <FormField id="message-record-audience" label="مخاطبان" required>
              <Input
                disabled={viewing}
                id="message-record-audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
              />
            </FormField>
            <FormField id="message-record-body" label="متن پیام" required>
              <Textarea
                disabled={viewing}
                id="message-record-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </FormField>
          </>
        )}
        {!viewing ? (
          <Button className="md:col-span-2" onClick={() => void save()}>
            <Save aria-hidden="true" className="size-4" />
            ذخیره
          </Button>
        ) : null}
      </Card>
      <AssetTable
        items={rows}
        onDelete={async (item) => {
          try {
            await marketingApi.deleteAsset(item.id, item.version);
            await data.load();
            onNotice('رکورد حذف شد.');
          } catch (reason) {
            onNotice(
              reason instanceof Error ? reason.message : 'حذف انجام نشد.',
            );
          }
        }}
        onSelect={fill}
      />
    </section>
  );
}

const CONTENT_KIND = {
  forms: 'FORM',
  landing: 'LANDING_PAGE',
  links: 'SHORT_LINK',
} as const;

export function DurableContentPanel({
  tab,
  onNotice,
}: {
  tab: keyof typeof CONTENT_KIND;
  onNotice: Notice;
}) {
  const kind = CONTENT_KIND[tab];
  const data = useMarketingData([
    kind,
    ...(kind === 'LANDING_PAGE' ? ['FORM' as const] : []),
  ]);
  const rows = data.assets.filter((item) => item.kind === kind);
  const related = data.assets.filter((item) => item.kind === 'FORM');
  const [editing, setEditing] = useState<MarketingAssetViewV1 | null>(null);
  const [viewing, setViewing] = useState(false);
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('none');
  const [status, setStatus] = useState('DRAFT');
  const [type, setType] = useState('REGISTRATION');
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('0');
  const [relatedId, setRelatedId] = useState('none');
  const [expiresAt, setExpiresAt] = useState('');
  const labels: readonly [string, string] =
    tab === 'forms'
      ? ['صفحه فرود', 'نرخ تکمیل / تعداد پاسخ']
      : tab === 'landing'
        ? ['دامنه یا سایت HTTP(S)', 'بازدید / تبدیل / آخرین انتشار']
        : ['نشانی مقصد HTTP(S)', 'لینک کوتاه HTTP(S) / کلیک / تبدیل'];
  const save = async () => {
    if (!data.actor?.branchIds[0]) return;
    const payload =
      tab === 'forms'
        ? {
            type,
            landingPage: primary,
            completionRate: secondary.split('/')[0]?.trim() ?? '0',
            responseCount: secondary.split('/')[1]?.trim() ?? '0',
          }
        : tab === 'landing'
          ? {
              domainUrl: primary,
              visits: secondary.split('/')[0]?.trim() ?? '0',
              conversions: secondary.split('/')[1]?.trim() ?? '0',
              lastPublishedAt: secondary.split('/')[2]?.trim() ?? '',
            }
          : {
              targetUrl: primary,
              shortUrl: secondary.split('/')[0]?.trim() ?? '',
              clicks: secondary.split('/')[1]?.trim() ?? '0',
              conversions: secondary.split('/')[2]?.trim() ?? '0',
            };
    try {
      await marketingApi.saveAsset(
        {
          kind,
          name,
          status,
          campaignId: campaignId === 'none' ? null : campaignId,
          relatedAssetId: relatedId === 'none' ? null : relatedId,
          expiresAt:
            tab === 'links' && expiresAt
              ? new Date(expiresAt).toISOString()
              : null,
          payload,
          ...(editing ? { expectedVersion: editing.version } : {}),
        },
        {
          ...(editing ? { id: editing.id } : {}),
          branchId: data.actor.branchIds[0],
        },
      );
      setEditing(null);
      setViewing(false);
      setName('');
      await data.load();
      onNotice(
        'رکورد محتوا با نسخه پایدار ذخیره شد؛ انتشار وب‌سایت انجام نشد.',
      );
    } catch (reason) {
      onNotice(
        reason instanceof Error ? reason.message : 'ذخیره محتوا انجام نشد.',
      );
    }
  };
  const fill = (item: MarketingAssetViewV1, mode: 'view' | 'edit') => {
    setEditing(mode === 'edit' ? item : null);
    setViewing(mode === 'view');
    setName(item.name);
    setCampaignId(item.campaignId ?? 'none');
    setStatus(item.status);
    setRelatedId(item.relatedAssetId ?? 'none');
    setExpiresAt(item.expiresAt ?? '');
    setType(String(item.payload.type ?? 'REGISTRATION'));
    setPrimary(
      String(
        item.payload.landingPage ??
          item.payload.domainUrl ??
          item.payload.targetUrl ??
          '',
      ),
    );
    setSecondary(
      tab === 'forms'
        ? `${item.payload.completionRate ?? 0} / ${item.payload.responseCount ?? 0}`
        : tab === 'landing'
          ? `${item.payload.visits ?? 0} / ${item.payload.conversions ?? 0} / ${item.payload.lastPublishedAt ?? ''}`
          : `${item.payload.shortUrl ?? ''} / ${item.payload.clicks ?? 0} / ${item.payload.conversions ?? 0}`,
    );
  };
  return (
    <section className="grid gap-4">
      <LoadState
        error={data.error}
        loading={data.loading}
        onRetry={() => void data.load()}
      />
      <Card className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <FormField id="content-record-name" label="نام" required>
          <Input
            disabled={viewing}
            id="content-record-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField id="content-record-type" label="نوع" required>
          <Input
            disabled={viewing}
            id="content-record-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </FormField>
        <FormField id="content-record-campaign" label="کمپین">
          <Select
            disabled={viewing}
            value={campaignId}
            onValueChange={setCampaignId}
          >
            <SelectTrigger id="content-record-campaign">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون کمپین</SelectItem>
              {data.campaigns.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="content-record-status" label="وضعیت" required>
          <Input
            disabled={viewing}
            id="content-record-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        </FormField>
        <FormField id="content-record-primary" label={labels[0]} required>
          <Input
            dir={tab === 'forms' ? 'rtl' : 'ltr'}
            disabled={viewing}
            id="content-record-primary"
            value={primary}
            onChange={(event) => setPrimary(event.target.value)}
          />
        </FormField>
        <FormField id="content-record-secondary" label={labels[1]} required>
          <Input
            disabled={viewing}
            id="content-record-secondary"
            value={secondary}
            onChange={(event) => setSecondary(event.target.value)}
          />
        </FormField>
        {tab === 'landing' ? (
          <FormField id="content-record-form" label="فرم متصل">
            <Select
              disabled={viewing}
              value={relatedId}
              onValueChange={setRelatedId}
            >
              <SelectTrigger id="content-record-form">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون فرم</SelectItem>
                {related.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        {tab === 'links' ? (
          <FormField id="content-record-expiry" label="تاریخ انقضا">
            <DatePicker
              id="content-record-expiry"
              includeTime
              readOnly={viewing}
              value={expiresAt}
              onChange={setExpiresAt}
            />
          </FormField>
        ) : null}
        {!viewing ? (
          <Button
            className="md:col-span-2 xl:col-span-3"
            onClick={() => void save()}
          >
            <Save aria-hidden="true" className="size-4" />
            ذخیره
          </Button>
        ) : null}
      </Card>
      <AssetTable
        items={rows}
        onDelete={async (item) => {
          try {
            await marketingApi.deleteAsset(item.id, item.version);
            await data.load();
            onNotice('رکورد حذف شد.');
          } catch (reason) {
            onNotice(
              reason instanceof Error ? reason.message : 'حذف انجام نشد.',
            );
          }
        }}
        onSelect={fill}
      />
    </section>
  );
}

export function DurableAutomationBuilder({ onNotice }: { onNotice: Notice }) {
  const data = useMarketingData(['AUTOMATION']);
  const [name, setName] = useState('اتوماسیون جدید');
  const [nodes, setNodes] = useState<Array<{ id: string; title: string }>>([
    { id: crypto.randomUUID(), title: 'شروع' },
  ]);
  const [edges, setEdges] = useState<
    Array<{
      source: string;
      target: string;
      sourcePort: string;
      targetPort: string;
    }>
  >([]);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const addStage = () =>
    setNodes((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: `مرحله ${(current.length + 1).toLocaleString('fa-IR')}`,
      },
    ]);
  return (
    <section className="grid gap-4">
      <LoadState
        error={data.error}
        loading={data.loading}
        onRetry={() => void data.load()}
      />
      <Card className="grid gap-4 p-5">
        <FormField id="automation-name" label="نام اتوماسیون">
          <Input
            id="automation-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {nodes.map((node) => (
            <div
              className="relative rounded-2xl border-2 border-primary/30 bg-surface p-6 text-center"
              key={node.id}
            >
              {['top', 'right', 'bottom', 'left'].map((port) => (
                <span
                  aria-label={`درگاه ${port} ${node.title}`}
                  className={`absolute size-3 rounded-full bg-primary ${port === 'top' ? '-top-1.5 left-1/2' : port === 'bottom' ? '-bottom-1.5 left-1/2' : port === 'right' ? 'right-[-6px] top-1/2' : 'left-[-6px] top-1/2'}`}
                  key={port}
                  role="img"
                />
              ))}
              <strong>{node.title}</strong>
              <small className="mt-2 block font-mono text-[10px] text-muted-foreground">
                {node.id}
              </small>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={addStage} variant="outline">
            <Plus aria-hidden="true" className="size-4" />
            افزودن مرحله
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField id="edge-source" label="گره مبدا">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="edge-source">
                <SelectValue placeholder="انتخاب" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="edge-target" label="گره مقصد">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="edge-target">
                <SelectValue placeholder="انتخاب" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <Button
          disabled={!source || !target || source === target}
          onClick={() =>
            setEdges((current) => [
              ...current,
              { source, target, sourcePort: 'right', targetPort: 'left' },
            ])
          }
        >
          اتصال گره‌ها
        </Button>
        <p className="text-sm text-muted-foreground">
          {edges.length.toLocaleString('fa-IR')} اتصال معتبر چهارسمتی تعریف شده
          است.
        </p>
        <Button
          onClick={async () => {
            if (!data.actor?.branchIds[0]) return;
            try {
              await marketingApi.saveAsset(
                {
                  kind: 'AUTOMATION',
                  name,
                  status: 'DRAFT',
                  payload: { nodes, edges },
                },
                { branchId: data.actor.branchIds[0] },
              );
              await data.load();
              onNotice('گراف اتوماسیون ذخیره شد؛ هیچ اجرای خارجی انجام نشد.');
            } catch (reason) {
              onNotice(
                reason instanceof Error
                  ? reason.message
                  : 'ذخیره اتوماسیون انجام نشد.',
              );
            }
          }}
        >
          <Save aria-hidden="true" className="size-4" />
          ذخیره اتوماسیون
        </Button>
      </Card>
      <AssetTable
        items={data.assets}
        onDelete={async (item) => {
          try {
            await marketingApi.deleteAsset(item.id, item.version);
            await data.load();
          } catch (reason) {
            onNotice(
              reason instanceof Error ? reason.message : 'حذف انجام نشد.',
            );
          }
        }}
        onSelect={(item) => {
          setName(item.name);
          setNodes((item.payload.nodes as typeof nodes) ?? []);
          setEdges((item.payload.edges as typeof edges) ?? []);
        }}
      />
    </section>
  );
}
