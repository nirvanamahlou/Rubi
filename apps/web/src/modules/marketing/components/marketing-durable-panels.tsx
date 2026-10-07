'use client';
import { uiConfirm } from '@/i18n/dialogs';

import type {
  AuthenticatedActor,
  CustomerAffairsMarketingIntakeViewV1,
  MarketingAssetKind,
  MarketingAssetViewV1,
  MarketingCampaignViewV1,
} from '@nora/contracts';
import {
  Calculator,
  Eye,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { marketingApi } from '../api/records-client';
import { campaignChannelLabels } from '../model/marketing';
import {
  AUTOMATION_NODE_SIZE,
  automationCanvasSize,
  automationDraftFromAsset,
  automationEdgeLines,
  automationInputFromDraft,
  automationNodePoint,
  automationPortPoint,
  contentDraftFromAsset,
  contentInputFromDraft,
  emptyContentDraft,
  emptyMessageFormState,
  scheduledMessagePayload,
  type AutomationDraft,
  type AutomationPort,
  type ContentDraft,
} from '../model/durable-records';

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
        aria-label="تلاش دوباره"
        className="justify-self-center"
        onClick={onRetry}
        size="icon"
        title="تلاش دوباره"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
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
            <Button
              aria-label={saving ? 'در حال ذخیره سگمنت' : 'ذخیره سگمنت'}
              disabled={saving}
              onClick={() => void save()}
              size="icon"
              title="ذخیره سگمنت"
            >
              <Save aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
          {editing || viewing ? (
            <Button
              aria-label="بستن فرم سگمنت"
              onClick={() => {
                setEditing(null);
                setViewing(false);
                setName('');
                setRule('');
              }}
              size="icon"
              title="بستن"
              variant="outline"
            >
              <X aria-hidden="true" className="size-4" />
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
  const [selected, setSelected] =
    useState<CustomerAffairsMarketingIntakeViewV1 | null>(null);
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
            aria-label="ذخیره سرنخ جدید"
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
            size="icon"
            title="سرنخ جدید"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="پاک‌کردن فرم سرنخ"
            onClick={() => {
              setPhone('');
              setSource('WEBSITE');
              setCampaignId('none');
              setStatus('NEW');
              setLastFollowUpAt('');
            }}
            size="icon"
            title="سرنخ جدید"
            type="button"
            variant="outline"
          >
            <X aria-hidden="true" className="size-4" />
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
                  aria-label={`محاسبه امتیاز ${item.maskedPhone}`}
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
                  size="icon"
                  title="محاسبه امتیاز"
                >
                  <Calculator aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge>
                    {item.campaignId ? 'منتسب به کمپین' : 'بدون کمپین'}
                  </Badge>
                  <Button
                    aria-label={`مشاهده سرنخ ${item.maskedPhone}`}
                    onClick={() => setSelected(item)}
                    size="icon"
                    title="جزئیات سرنخ"
                    variant="outline"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                  </Button>
                </div>
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
      {selected ? (
        <Card className="grid gap-3 p-5 md:grid-cols-3">
          <strong className="md:col-span-3">جزئیات سرنخ محافظت‌شده</strong>
          {[
            ['تلفن', selected.maskedPhone],
            ['منبع', selected.sourceCategory],
            ['وضعیت', selected.status],
            ['کمپین', selected.campaignId ?? '—'],
            ['کارشناس', selected.assigneeUserId ?? '—'],
            ['آخرین پیگیری', selected.lastFollowUpAt ?? '—'],
            ['امتیاز', String(selected.score)],
            ['قواعد امتیاز', selected.scoreRuleIds.join('، ') || '—'],
            ['نسخه', String(selected.version)],
            ['ایجاد', selected.createdAt],
            ['به‌روزرسانی', selected.updatedAt],
          ].map(([label, value]) => (
            <div key={label}>
              <small className="text-muted-foreground">{label}</small>
              <p className="break-all font-bold">{value}</p>
            </div>
          ))}
          <Button
            aria-label="بستن جزئیات"
            onClick={() => setSelected(null)}
            size="icon"
            title="بستن"
            variant="outline"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </Card>
      ) : null}
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
        <Button
          aria-label="اعمال بازه"
          disabled={loading}
          onClick={() => void load()}
          size="icon"
          title="اعمال بازه"
        >
          <Save aria-hidden="true" className="size-4" />
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
    scheduled ? ['MESSAGE', 'SCHEDULE'] : ['MESSAGE', 'SEGMENT'],
  );
  const messages = data.assets.filter((item) => item.kind === 'MESSAGE');
  const segments = data.assets.filter((item) => item.kind === 'SEGMENT');
  const rows = data.assets.filter(
    (item) => item.kind === (scheduled ? 'SCHEDULE' : 'MESSAGE'),
  );
  const [editing, setEditing] = useState<MarketingAssetViewV1 | null>(null);
  const [viewing, setViewing] = useState(false);
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('none');
  const [messageId, setMessageId] = useState('none');
  const [channels, setChannels] = useState<string[]>(['SMS']);
  const [scheduledChannel, setScheduledChannel] = useState('SMS');
  const [status, setStatus] = useState('DRAFT');
  const [audienceId, setAudienceId] = useState('none');
  const [body, setBody] = useState('');
  const [sendMode, setSendMode] = useState('NOW');
  const [sendAt, setSendAt] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const resetForm = () => {
    const empty = emptyMessageFormState();
    setEditing(null);
    setViewing(false);
    setName(empty.name);
    setCampaignId(empty.campaignId);
    setMessageId(empty.messageId);
    setChannels(empty.channels);
    setScheduledChannel(empty.scheduledChannel);
    setStatus(empty.status);
    setAudienceId(empty.audienceId);
    setBody(empty.body);
    setSendMode(empty.sendMode);
    setSendAt(empty.sendAt);
    setScheduledAt(empty.scheduledAt);
  };
  const fill = (item: MarketingAssetViewV1, mode: 'view' | 'edit') => {
    setEditing(mode === 'edit' ? item : null);
    setViewing(mode === 'view');
    setName(item.name);
    setCampaignId(item.campaignId ?? 'none');
    setMessageId(item.relatedAssetId ?? 'none');
    setChannels(
      Array.isArray(item.payload.channels)
        ? item.payload.channels.map(String)
        : [String(item.payload.channel ?? 'SMS')],
    );
    setScheduledChannel(String(item.payload.channel ?? 'SMS'));
    setStatus(item.status);
    setAudienceId(
      item.kind === 'MESSAGE' ? (item.relatedAssetId ?? 'none') : 'none',
    );
    setBody(String(item.payload.body ?? ''));
    setSendMode(String(item.payload.sendMode ?? 'NOW'));
    setSendAt(String(item.payload.sendAt ?? ''));
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
            : audienceId === 'none'
              ? null
              : audienceId,
          scheduledAt: scheduled ? new Date(scheduledAt).toISOString() : null,
          payload: scheduled
            ? scheduledMessagePayload(scheduledChannel, status)
            : {
                channels,
                audience:
                  segments.find((item) => item.id === audienceId)?.name ?? '',
                body,
                sendMode,
                sendAt:
                  sendMode === 'SCHEDULED' && sendAt
                    ? new Date(sendAt).toISOString()
                    : null,
              },
          ...(editing ? { expectedVersion: editing.version } : {}),
        },
        {
          ...(editing ? { id: editing.id } : {}),
          branchId: data.actor.branchIds[0],
        },
      );
      resetForm();
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
        {scheduled ? (
          <FormField id="schedule-record-channel" label="کانال" required>
            <Select
              disabled={viewing}
              value={scheduledChannel}
              onValueChange={setScheduledChannel}
            >
              <SelectTrigger id="schedule-record-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ['SMS', 'EMAIL', 'WHATSAPP', 'PUSH_NOTIFICATION'] as const
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {campaignChannelLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : (
          <fieldset className="grid gap-2" disabled={viewing}>
            <legend className="text-sm font-bold">کانال‌ها</legend>
            <div className="flex flex-wrap gap-3">
              {(['SMS', 'EMAIL', 'WHATSAPP', 'PUSH_NOTIFICATION'] as const).map(
                (value) => (
                  <label className="flex items-center gap-2" key={value}>
                    <Checkbox
                      checked={channels.includes(value)}
                      onCheckedChange={(checked) =>
                        setChannels((current) =>
                          checked
                            ? [...new Set([...current, value])]
                            : current.filter((channel) => channel !== value),
                        )
                      }
                    />
                    {campaignChannelLabels[value]}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        )}
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
            <FormField
              id="message-record-audience"
              label="سگمنت مخاطب"
              required
            >
              <Select
                disabled={viewing}
                value={audienceId}
                onValueChange={setAudienceId}
              >
                <SelectTrigger id="message-record-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">انتخاب کنید</SelectItem>
                  {segments.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="message-record-body" label="متن پیام" required>
              <Textarea
                disabled={viewing}
                id="message-record-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </FormField>
            <FormField id="message-record-send-mode" label="روش ارسال" required>
              <Select
                disabled={viewing}
                value={sendMode}
                onValueChange={setSendMode}
              >
                <SelectTrigger id="message-record-send-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOW">فوری</SelectItem>
                  <SelectItem value="SCHEDULED">زمان‌بندی‌شده</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {sendMode === 'SCHEDULED' ? (
              <FormField
                id="message-record-send-at"
                label="زمان ارسال"
                required
              >
                <DatePicker
                  id="message-record-send-at"
                  includeTime
                  readOnly={viewing}
                  value={sendAt}
                  onChange={setSendAt}
                />
              </FormField>
            ) : null}
          </>
        )}
        <Button
          aria-label="پیام جدید"
          onClick={resetForm}
          size="icon"
          title="پیام جدید"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
        {!viewing ? (
          <div className="flex justify-end md:col-span-2" dir="rtl">
            <Button
              aria-label={scheduled ? 'ذخیره ارسال' : 'ذخیره پیام'}
              onClick={() => void save()}
              size="icon"
              title="ذخیره"
            >
              <Save aria-hidden="true" className="size-4" />
            </Button>
          </div>
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
    ...(kind === 'LANDING_PAGE'
      ? (['FORM'] as const)
      : kind === 'FORM'
        ? (['LANDING_PAGE'] as const)
        : []),
  ]);
  const rows = data.assets.filter((item) => item.kind === kind);
  const related = data.assets.filter((item) =>
    kind === 'FORM' ? item.kind === 'LANDING_PAGE' : item.kind === 'FORM',
  );
  const [editing, setEditing] = useState<MarketingAssetViewV1 | null>(null);
  const [viewing, setViewing] = useState(false);
  const [draft, setDraft] = useState<ContentDraft>(emptyContentDraft);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const typeLabels: Record<string, string> = {
    REGISTRATION: 'ثبت‌نام',
    CONTACT: 'تماس',
    SURVEY: 'نظرسنجی',
    LEAD: 'جذب سرنخ',
  };
  const statusLabels: Record<string, string> = {
    DRAFT: 'پیش‌نویس',
    ACTIVE: 'فعال',
    PAUSED: 'متوقف',
    ARCHIVED: 'بایگانی‌شده',
  };
  const normalize = (value: string) =>
    value.replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLocaleLowerCase().trim();
  const visibleRows = rows.filter((item) =>
    normalize(
      [
        item.name,
        item.payload.type ? typeLabels[String(item.payload.type)] : '',
        statusLabels[item.status],
        data.campaigns.find((campaign) => campaign.id === item.campaignId)
          ?.name,
        item.payload.domainUrl,
        item.payload.targetUrl,
      ].join(' '),
    ).includes(normalize(search)),
  );
  const labels: readonly [string, string, string, string] =
    tab === 'forms'
      ? ['صفحه فرود', 'نرخ تکمیل', 'تعداد پاسخ', '']
      : tab === 'landing'
        ? ['دامنه یا سایت HTTP(S)', 'بازدید', 'تبدیل', 'آخرین انتشار']
        : ['نشانی مقصد HTTP(S)', 'لینک کوتاه HTTP(S)', 'کلیک', 'تبدیل'];
  const updateDraft = <K extends keyof ContentDraft>(
    key: K,
    value: ContentDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (busy) return;
    if (!data.actor?.branchIds[0]) {
      setFormError('دسترسی شعبه برای ثبت محتوا موجود نیست.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await marketingApi.saveAsset(contentInputFromDraft(tab, draft), {
        ...(editing ? { id: editing.id } : {}),
        branchId: data.actor.branchIds[0],
      });
      setEditing(null);
      setViewing(false);
      setDraft(emptyContentDraft());
      setOpen(false);
      await data.load();
      onNotice(
        'رکورد محتوا با نسخه پایدار ذخیره شد؛ انتشار وب‌سایت انجام نشد.',
      );
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : 'ذخیره محتوا انجام نشد.',
      );
      onNotice(
        reason instanceof Error ? reason.message : 'ذخیره محتوا انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  };
  const fill = (item: MarketingAssetViewV1, mode: 'view' | 'edit') => {
    setEditing(mode === 'edit' ? item : null);
    setViewing(mode === 'view');
    setDraft(contentDraftFromAsset(item));
    setFormError('');
    setOpen(true);
  };
  return (
    <section className="grid gap-4 text-right" dir="rtl">
      <LoadState
        error={data.error}
        loading={data.loading}
        onRetry={() => void data.load()}
      />
      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-60 flex-1">
          <FormField id="content-list-search" label="جست‌وجوی محتوا">
            <Input
              id="content-list-search"
              type="search"
              placeholder="نام، کمپین یا نشانی را جست‌وجو کنید"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </div>
        <Button
          aria-label="افزودن محتوا"
          title="افزودن محتوا"
          size="icon"
          disabled={data.loading || !!data.error}
          onClick={() => {
            setEditing(null);
            setViewing(false);
            setDraft(emptyContentDraft());
            setFormError('');
            setOpen(true);
          }}
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[85vh] max-w-3xl overflow-y-auto text-right"
        >
          <DialogTitle>
            {viewing
              ? 'مشاهده محتوا'
              : editing
                ? 'ویرایش محتوا'
                : 'افزودن محتوا'}
          </DialogTitle>
          <DialogDescription>
            {tab === 'forms'
              ? 'فرم'
              : tab === 'landing'
                ? 'صفحه فرود'
                : 'لینک رهگیری'}
          </DialogDescription>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy} className="contents">
              <FormField id="content-record-name" label="نام" required>
                <Input
                  disabled={viewing}
                  id="content-record-name"
                  required
                  minLength={2}
                  value={draft.name}
                  onChange={(event) => updateDraft('name', event.target.value)}
                />
              </FormField>
              {tab === 'forms' ? (
                <FormField id="content-record-type" label="نوع" required>
                  <Select
                    disabled={viewing}
                    value={draft.type}
                    onValueChange={(value) => updateDraft('type', value)}
                  >
                    <SelectTrigger id="content-record-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['REGISTRATION', 'CONTACT', 'SURVEY', 'LEAD'].map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {typeLabels[value]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
              <FormField id="content-record-campaign" label="کمپین">
                <Select
                  disabled={viewing}
                  value={draft.campaignId}
                  onValueChange={(value) => updateDraft('campaignId', value)}
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
                <Select
                  disabled={viewing}
                  value={draft.status}
                  onValueChange={(value) => updateDraft('status', value)}
                >
                  <SelectTrigger id="content-record-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'].map((value) => (
                      <SelectItem key={value} value={value}>
                        {statusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="content-record-primary" label={labels[0]} required>
                <Input
                  dir={tab === 'forms' ? 'rtl' : 'ltr'}
                  disabled={viewing}
                  id="content-record-primary"
                  required
                  value={draft.primary}
                  onChange={(event) =>
                    updateDraft('primary', event.target.value)
                  }
                />
              </FormField>
              <FormField
                id="content-record-secondary"
                label={labels[1]}
                required
              >
                <Input
                  disabled={viewing}
                  id="content-record-secondary"
                  required
                  dir={tab === 'forms' ? 'ltr' : undefined}
                  value={draft.metricOne}
                  onChange={(event) =>
                    updateDraft('metricOne', event.target.value)
                  }
                />
              </FormField>
              <FormField
                id="content-record-metric-two"
                label={labels[2]}
                required
              >
                <Input
                  disabled={viewing}
                  id="content-record-metric-two"
                  required
                  type="number"
                  min={0}
                  dir="ltr"
                  value={draft.metricTwo}
                  onChange={(event) =>
                    updateDraft('metricTwo', event.target.value)
                  }
                />
              </FormField>
              {labels[3] ? (
                <FormField
                  id="content-record-metric-three"
                  label={labels[3]}
                  required
                >
                  <Input
                    disabled={viewing}
                    id="content-record-metric-three"
                    dir="ltr"
                    value={draft.metricThree}
                    onChange={(event) =>
                      updateDraft('metricThree', event.target.value)
                    }
                  />
                </FormField>
              ) : null}
              {tab === 'landing' || tab === 'forms' ? (
                <FormField
                  id="content-record-related"
                  label={tab === 'forms' ? 'صفحه فرود متصل' : 'فرم متصل'}
                >
                  <Select
                    disabled={viewing}
                    value={draft.relatedId}
                    onValueChange={(value) => updateDraft('relatedId', value)}
                  >
                    <SelectTrigger id="content-record-related">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون رکورد متصل</SelectItem>
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
                    value={draft.expiresAt}
                    onChange={(value) => updateDraft('expiresAt', value)}
                  />
                </FormField>
              ) : null}
              {!viewing ? (
                <Button
                  aria-label="ذخیره رکورد محتوا"
                  className="justify-self-end md:col-span-2"
                  disabled={busy}
                  type="submit"
                  size="icon"
                  title="ذخیره"
                >
                  <Save aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </fieldset>
            {formError ? (
              <p role="alert" className="text-destructive md:col-span-2">
                {formError}
              </p>
            ) : null}
          </form>
        </DialogContent>
      </Dialog>
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          {visibleRows.length.toLocaleString('fa-IR')} رکورد
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <caption className="sr-only">فهرست محتوای مارکتینگ</caption>
            <thead className="bg-muted/50">
              <tr>
                {[
                  'نام',
                  ...(tab === 'forms' ? ['نوع'] : []),
                  'کمپین',
                  labels[0],
                  labels[1],
                  labels[2],
                  'وضعیت',
                  'عملیات',
                ].map((label) => (
                  <th key={label} scope="col" className="p-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => {
                const row = contentDraftFromAsset(item);
                return (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    <td className="p-4 font-medium">{item.name}</td>
                    {tab === 'forms' ? (
                      <td className="p-4">{typeLabels[row.type] ?? 'سایر'}</td>
                    ) : null}
                    <td className="p-4">
                      {data.campaigns.find(
                        (campaign) => campaign.id === item.campaignId,
                      )?.name ?? 'بدون کمپین'}
                    </td>
                    <td
                      className="max-w-64 truncate p-4"
                      title={row.primary}
                      dir={tab === 'forms' ? 'rtl' : 'ltr'}
                    >
                      {row.primary || '—'}
                    </td>
                    <td className="p-4">{row.metricOne || '۰'}</td>
                    <td className="p-4">{row.metricTwo || '۰'}</td>
                    <td className="p-4">
                      {statusLabels[item.status] ?? 'نامشخص'}
                    </td>
                    <td className="p-4">
                      <AssetActions
                        item={item}
                        onView={() => fill(item, 'view')}
                        onEdit={() => fill(item, 'edit')}
                        onDelete={async () => {
                          if (!uiConfirm(`«${item.name}» حذف شود؟`)) return;
                          try {
                            await marketingApi.deleteAsset(
                              item.id,
                              item.version,
                            );
                            await data.load();
                            onNotice('رکورد حذف شد.');
                          } catch (reason) {
                            onNotice(
                              reason instanceof Error
                                ? reason.message
                                : 'حذف انجام نشد.',
                            );
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!data.loading && !visibleRows.length ? (
          <p className="p-8 text-center text-muted-foreground">
            {search
              ? 'رکوردی مطابق جست‌وجو پیدا نشد.'
              : 'هنوز محتوایی ثبت نشده است.'}
          </p>
        ) : null}
      </Card>
    </section>
  );
}

export function AutomationGraphCanvas({
  draft,
  onPortSelect,
}: {
  draft: AutomationDraft;
  onPortSelect?: ((nodeId: string, port: AutomationPort) => void) | undefined;
}) {
  const edgeLines = automationEdgeLines(draft);
  const canvas = automationCanvasSize(draft.nodes.length);
  return (
    <div className="overflow-auto rounded-2xl border border-border bg-muted/20">
      <svg
        aria-label="اتصال‌های ذخیره‌شده گراف اتوماسیون"
        className="block w-full min-w-80"
        style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
        role="group"
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      >
        <defs>
          <marker
            id="marketing-automation-arrow"
            markerHeight="5"
            markerWidth="5"
            orient="auto"
            refX="4"
            refY="2.5"
            viewBox="0 0 5 5"
          >
            <path d="M 0 0 L 5 2.5 L 0 5 z" fill="currentColor" />
          </marker>
        </defs>
        {edgeLines.map((edge, index) => (
          <line
            data-source-port={edge.sourcePort}
            data-target-port={edge.targetPort}
            data-source={edge.source}
            data-target={edge.target}
            key={`${edge.source}-${edge.target}-${index}`}
            markerEnd="url(#marketing-automation-arrow)"
            stroke="currentColor"
            strokeWidth="2"
            x1={edge.sourcePoint.x}
            x2={edge.targetPoint.x}
            y1={edge.sourcePoint.y}
            y2={edge.targetPoint.y}
          />
        ))}
        {draft.nodes.map((node, index) => {
          const point = automationNodePoint(index, draft.nodes.length);
          return (
            <Fragment key={node.id}>
              <foreignObject
                data-node={node.id}
                x={point.x - AUTOMATION_NODE_SIZE.width / 2}
                y={point.y - AUTOMATION_NODE_SIZE.height / 2}
                width={AUTOMATION_NODE_SIZE.width}
                height={AUTOMATION_NODE_SIZE.height}
              >
                <div className="box-border size-full overflow-auto rounded-2xl border-2 border-primary/30 bg-surface p-4 text-center shadow-sm">
                  <strong>{node.title}</strong>
                  <small className="mt-2 block break-all font-mono text-[10px] text-muted-foreground">
                    {node.id}
                  </small>
                </div>
              </foreignObject>
              {(['top', 'right', 'bottom', 'left'] as const).map((port) => {
                const position = automationPortPoint(point, port);
                return (
                  <foreignObject
                    key={port}
                    data-node-port={`${node.id}:${port}`}
                    x={position.x - 12}
                    y={position.y - 12}
                    width={24}
                    height={24}
                  >
                    <button
                      aria-label={`درگاه ${port} ${node.title}`}
                      className="grid size-full place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      disabled={!onPortSelect}
                      onClick={() => onPortSelect?.(node.id, port)}
                      title={`انتخاب درگاه ${port}`}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="size-3 rounded-full bg-primary"
                      />
                    </button>
                  </foreignObject>
                );
              })}
            </Fragment>
          );
        })}
      </svg>
    </div>
  );
}

export function DurableAutomationBuilder({ onNotice }: { onNotice: Notice }) {
  const data = useMarketingData(['AUTOMATION']);
  const emptyAutomation = (): AutomationDraft => ({
    name: 'اتوماسیون جدید',
    nodes: [{ id: crypto.randomUUID(), title: 'شروع' }],
    edges: [],
  });
  const [draft, setDraft] = useState<AutomationDraft>(emptyAutomation);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [sourcePort, setSourcePort] = useState<AutomationPort>('right');
  const [targetPort, setTargetPort] = useState<AutomationPort>('left');
  const [viewing, setViewing] = useState(false);
  const addStage = () =>
    setDraft((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id: crypto.randomUUID(),
          title: `مرحله ${(current.nodes.length + 1).toLocaleString('fa-IR')}`,
        },
      ],
    }));
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
            disabled={viewing}
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </FormField>
        <AutomationGraphCanvas
          draft={draft}
          onPortSelect={
            viewing
              ? undefined
              : (nodeId, port) => {
                  if (!source) {
                    setSource(nodeId);
                    setSourcePort(port);
                  } else {
                    setTarget(nodeId);
                    setTargetPort(port);
                  }
                }
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="افزودن مرحله"
            disabled={viewing}
            onClick={addStage}
            size="icon"
            title="افزودن مرحله"
            variant="outline"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField id="edge-source" label="گره مبدا">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="edge-source">
                <SelectValue placeholder="انتخاب" />
              </SelectTrigger>
              <SelectContent>
                {draft.nodes.map((node) => (
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
                {draft.nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="edge-source-port" label="درگاه مبدا">
            <Select
              disabled={viewing}
              value={sourcePort}
              onValueChange={(value) => setSourcePort(value as AutomationPort)}
            >
              <SelectTrigger id="edge-source-port">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['top', 'right', 'bottom', 'left'] as const).map((port) => (
                  <SelectItem key={port} value={port}>
                    {port}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="edge-target-port" label="درگاه مقصد">
            <Select
              disabled={viewing}
              value={targetPort}
              onValueChange={(value) => setTargetPort(value as AutomationPort)}
            >
              <SelectTrigger id="edge-target-port">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['top', 'right', 'bottom', 'left'] as const).map((port) => (
                  <SelectItem key={port} value={port}>
                    {port}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <Button
          aria-label="اتصال گره‌ها"
          disabled={viewing || !source || !target || source === target}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              edges: [
                ...current.edges,
                { source, target, sourcePort, targetPort },
              ],
            }))
          }
          size="icon"
          title="اتصال گره‌ها"
        >
          <Link2 aria-hidden="true" className="size-4" />
        </Button>
        <p className="text-sm text-muted-foreground">
          {draft.edges.length.toLocaleString('fa-IR')} اتصال معتبر چهارسمتی
          تعریف شده است.
        </p>
        <ul className="grid gap-2 text-sm">
          {draft.edges.map((edge, index) => (
            <li
              className="rounded-lg border border-border p-2"
              key={`${edge.source}-${edge.target}-${index}`}
            >
              {draft.nodes.find((node) => node.id === edge.source)?.title ??
                edge.source}{' '}
              · {edge.sourcePort} → {edge.targetPort} ·{' '}
              {draft.nodes.find((node) => node.id === edge.target)?.title ??
                edge.target}
            </li>
          ))}
        </ul>
        <Button
          aria-label="ذخیره اتوماسیون"
          disabled={viewing}
          onClick={async () => {
            if (!data.actor?.branchIds[0]) return;
            try {
              const saved = await marketingApi.saveAsset(
                automationInputFromDraft(draft),
                {
                  ...(draft.id ? { id: draft.id } : {}),
                  branchId: data.actor.branchIds[0],
                },
              );
              setDraft(automationDraftFromAsset(saved.data));
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
          size="icon"
          title="ذخیره اتوماسیون"
        >
          <Save aria-hidden="true" className="size-4" />
        </Button>
      </Card>
      <Button
        aria-label="اتوماسیون جدید"
        className="justify-self-start"
        onClick={() => {
          setDraft(emptyAutomation());
          setViewing(false);
          setSource('');
          setTarget('');
        }}
        size="icon"
        title="اتوماسیون جدید"
        variant="outline"
      >
        <Plus aria-hidden="true" className="size-4" />
      </Button>
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
        onSelect={(item, mode) => {
          setDraft(automationDraftFromAsset(item));
          setViewing(mode === 'view');
        }}
      />
    </section>
  );
}
