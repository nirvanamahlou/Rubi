'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import {
  ArrowLeft,
  Building2,
  ChartNoAxesCombined,
  FileText,
  Info,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  ShoppingCart,
  Users,
  Pencil,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cooperationLabel } from '../model/presentation';
import { Button } from '@/components/ui/button';
import {
  usePageBreadcrumbs,
  type PageBreadcrumb,
} from '@/components/layout/page-breadcrumbs';
import { OrganizationDocumentsPanel } from './organization-documents-panel';

const sections = [
  {
    id: 'organization',
    title: 'پرونده سازمان',
    icon: Building2,
    accent: '#1674e8',
    tint: '#eaf3ff',
    description: 'مشخصات، نقش‌ها، شعب، نمایندگان، امضاداران و مدیر حساب',
    tabs: [
      ['profile', 'مشخصات و نقش‌ها'],
      ['branches', 'شعب'],
      ['representatives', 'نمایندگان'],
      ['signatories', 'امضاداران'],
      ['manager', 'مدیر حساب'],
    ],
  },
  {
    id: 'access',
    title: 'کاربران و دسترسی',
    icon: KeyRound,
    accent: '#7958db',
    tint: '#f1edff',
    description: 'کاربران سازمان، نقش‌ها، شعب مجاز و زنجیره تأیید',
    tabs: [
      ['users', 'کاربران سازمان'],
      ['roles', 'نقش‌های سازمانی'],
      ['scopes', 'شعب و خدمات مجاز'],
      ['approvers', 'تأییدکنندگان'],
    ],
  },
  {
    id: 'contracts',
    title: 'قرارداد و شرایط تجاری',
    icon: FileText,
    accent: '#e98923',
    tint: '#fff4e7',
    description: 'قرارداد چارچوب، نرخ توافقی، تخفیف، پورسانت و اسناد',
    tabs: [
      ['framework', 'قرارداد چارچوب'],
      ['rates', 'نرخ‌های توافقی'],
      ['discounts', 'تخفیف'],
      ['commission', 'پورسانت'],
      ['documents', 'اسناد قرارداد'],
    ],
  },
  {
    id: 'credit',
    title: 'اعتبار و تضمین',
    icon: ShieldCheck,
    accent: '#12a97d',
    tint: '#e8f9f3',
    description: 'سیاست اعتبار، مانده، افزایش موقت و تضمین‌های فعال',
    tabs: [
      ['policy', 'سیاست اعتبار'],
      ['exposure', 'Exposure و مانده'],
      ['temporary', 'افزایش موقت'],
      ['guarantees', 'تضمین‌ها'],
    ],
  },
  {
    id: 'finance',
    title: 'مالی و تسویه',
    icon: Wallet,
    accent: '#1689b7',
    tint: '#e9f8ff',
    description: 'صورت‌حساب، فاکتور تجمیعی، دریافت، چک، تسویه و مغایرت',
    tabs: [
      ['statement', 'صورتحساب دوره‌ای'],
      ['invoice', 'فاکتور تجمیعی'],
      ['payments', 'دریافت‌ها'],
      ['checks', 'چک‌ها'],
      ['settlement', 'تسویه دوره‌ای'],
      ['disputes', 'مغایرت‌ها'],
    ],
  },
  {
    id: 'reports',
    title: 'گزارش و Audit',
    icon: ChartNoAxesCombined,
    accent: '#596f91',
    tint: '#f0f4f8',
    description: 'خروجی مجاز و تاریخچه تغییرات و دسترسی حساس',
    tabs: [
      ['reports', 'گزارش‌ها'],
      ['audit', 'Audit'],
      ['export', 'خروجی'],
    ],
  },
] as const;

export type OperationalView =
  | 'overview'
  | 'address'
  | 'credit'
  | 'guarantees'
  | 'agreements'
  | 'rates'
  | 'discounts'
  | 'commission'
  | 'manager'
  | 'profile';

export function CorporateMetric({
  label,
  value = '—',
  icon: Icon,
  tone = '',
  note,
}: {
  label: string;
  value?: string;
  icon: LucideIcon;
  tone?: string;
  note?: string;
}) {
  return (
    <article className="kpi">
      <div className={`kpi-icon ${tone}`}>
        <Icon size={23} />
      </div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </article>
  );
}

export function CorporateUnavailable({
  title,
  description = 'اطلاعات این بخش هنوز به پرونده سازمان متصل نشده است.',
}: {
  title: string;
  description?: string | undefined;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title">
          <Info size={20} />
          {title}
        </div>
        <span className="readonly">در انتظار اتصال</span>
      </header>
      <div className="empty" role="status">
        <Building2 size={42} aria-hidden="true" />
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </section>
  );
}

export function CorporateProfile({
  organization,
  onClose,
  onEdit,
  canEdit,
  onDelete,
  canDelete,
  contacts,
  operations,
  logo,
  overview,
}: {
  organization: MasterDataRecord;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
  onDelete: () => void;
  canDelete: boolean;
  contacts: ReactNode;
  operations: (view: OperationalView) => ReactNode;
  logo?: ReactNode;
  overview?: ReactNode;
}) {
  const [screen, setScreen] = useState('home');
  const [tab, setTab] = useState('profile');
  const roles = String(organization.attributes.roleCodes ?? '').split(',');
  const entityLabel =
    roles.includes('AGENCY') && !roles.includes('CORPORATE_CUSTOMER')
      ? 'آژانس'
      : 'سازمان';
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);
  const current = sections.find((section) => section.id === screen);
  const go = useCallback((id: string, requestedTab?: string) => {
    setScreen(id);
    setTab(
      requestedTab ??
        sections.find((section) => section.id === id)?.tabs[0][0] ??
        'profile',
    );
  }, []);
  const title = current?.title ?? `نمای ۳۶۰ درجه ${entityLabel}`;
  const breadcrumbs = useMemo<readonly PageBreadcrumb[]>(
    () => [
      {
        key: 'organizations',
        title: 'آژانس‌ها و مشتریان سازمانی',
        onSelect: onClose,
      },
      {
        key: organization.id,
        title: organization.name,
        onSelect: () => go('home'),
      },
      ...(current ? [{ key: current.id, title: current.title }] : []),
    ],
    [onClose, organization.id, organization.name, go, current],
  );
  usePageBreadcrumbs('/organizations', breadcrumbs);
  const operationalView: OperationalView | undefined =
    screen === 'organization' && tab === 'branches'
      ? 'address'
      : screen === 'contracts' && tab === 'framework'
        ? 'agreements'
        : screen === 'contracts' &&
            ['rates', 'discounts', 'commission'].includes(tab)
          ? (tab as 'rates' | 'discounts' | 'commission')
          : screen === 'organization' && tab === 'manager'
            ? 'manager'
            : screen === 'credit' && tab === 'guarantees'
              ? 'guarantees'
              : screen === 'credit' && ['policy', 'exposure'].includes(tab)
                ? 'credit'
                : undefined;
  return (
    <div className="corporate-profile">
      <div className="page-head">
        <div className="title">
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <p>
            {current?.description ??
              'تصویر یکپارچه رابطه تجاری و نمای عملیات سازمان'}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>
            بازگشت به فهرست <ArrowLeft size={18} />
          </button>
        </div>
      </div>
      <section className="org-banner">
        {logo ?? (
          <div className="org-logo">
            <Building2 size={31} />
          </div>
        )}
        <div className="org-main">
          <h2>{organization.name}</h2>
          <div className="org-meta">
            <span className="badge purple">
              {cooperationLabel(organization.attributes.roleCodes)}
            </span>
            <span
              className={`badge ${organization.status === 'active' ? 'success' : 'neutral'}`}
            >
              {organization.status === 'active'
                ? 'سازمان فعال'
                : 'سازمان غیرفعال'}
            </span>
            <span>
              کد سازمان: <bdi>{organization.code}</bdi>
            </span>
          </div>
        </div>
        <div className="org-actions">
          <Button variant="outline" disabled={!canEdit} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" /> ویرایش{' '}
            {entityLabel}
          </Button>
          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" className="size-4" /> حذف دائمی{' '}
            {entityLabel}
          </Button>
          <button className="btn" onClick={onClose}>
            تغییر {entityLabel}
          </button>
          <button className="btn primary" onClick={() => go('home')}>
            <LayoutDashboard size={18} />
            نمای ۳۶۰ درجه
          </button>
        </div>
      </section>
      {screen === 'home' ? (
        <>
          {overview}
          <section className="panel" aria-label="ثبت اطلاعات پرونده">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">ثبت اطلاعات پرونده</h2>
                <p className="panel-note">
                  اطلاعات هر بخش از همین پرونده ثبت و ویرایش می‌شود.
                </p>
              </div>
            </header>
            <div className="panel-body flex flex-wrap gap-2">
              <Button variant="outline" onClick={onEdit} disabled={!canEdit}>
                مشخصات {entityLabel}
              </Button>
              {[
                ['شعب و آدرس‌ها', 'organization', 'branches'],
                ['نمایندگان', 'organization', 'representatives'],
                ['مدیر حساب', 'organization', 'manager'],
                ['قرارداد همکاری', 'contracts', 'framework'],
                ['سقف اعتبار و تضمین', 'credit', 'policy'],
                ['نرخ توافقی', 'contracts', 'rates'],
                ['تخفیف', 'contracts', 'discounts'],
                ['پورسانت', 'contracts', 'commission'],
                ['اسناد پرونده', 'contracts', 'documents'],
              ].map(([label, sectionId, tabId]) => (
                <Button
                  key={label}
                  variant="outline"
                  onClick={() => go(sectionId!, tabId!)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </section>
          <div className="boundary-note">
            <Info size={20} />
            <span>
              مانده مالی، فاکتور، دریافت، چک، سفارش و فایل‌ها از بخش مربوط
              خوانده می‌شوند.
            </span>
          </div>
          <section className="kpis">
            <CorporateMetric
              label="اعتبار قابل استفاده"
              icon={Wallet}
              tone="green"
              note="اطلاعات مالی در دسترس نیست"
            />
            <CorporateMetric
              label="Exposure مالی"
              icon={Wallet}
              tone="amber"
              note="اطلاعات مالی در دسترس نیست"
            />
            <CorporateMetric
              label="سفارش باز"
              icon={ShoppingCart}
              note="در انتظار اتصال"
            />
            <CorporateMetric
              label="بدهی سررسیدشده"
              icon={ShieldCheck}
              tone="green"
              note="اطلاعات مالی در دسترس نیست"
            />
          </section>
          <section
            className="hub-grid"
            aria-label={`بخش‌های پرونده ${entityLabel}`}
          >
            {sections.map(
              ({
                id,
                title: label,
                icon: Icon,
                accent,
                tint,
                description,
                tabs,
              }) => (
                <article
                  className="hub-card"
                  key={id}
                  style={
                    { '--accent': accent, '--tint': tint } as CSSProperties
                  }
                >
                  <div className="hub-top">
                    <div className="hub-icon">
                      <Icon size={26} />
                    </div>
                    <div className="hub-copy">
                      <h3>{label}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                  <div className="pills">
                    {tabs.slice(0, 3).map(([key, text]) => (
                      <span className="pill" key={key}>
                        {text}
                      </span>
                    ))}
                    {tabs.length > 3 ? (
                      <span className="pill">
                        +{(tabs.length - 3).toLocaleString('fa-IR')}
                      </span>
                    ) : null}
                  </div>
                  <div className="hub-foot">
                    <small>{tabs.length.toLocaleString('fa-IR')} زیرصفحه</small>
                    <button
                      className="hub-link"
                      onClick={() => go(id)}
                      aria-label={`ورود به ${label}`}
                    >
                      ورود به بخش <ArrowLeft size={18} />
                    </button>
                  </div>
                </article>
              ),
            )}
          </section>
        </>
      ) : (
        <>
          <nav className="tabs" aria-label={`صفحه‌های ${title}`}>
            {current?.tabs.map(([id, label]) => (
              <button
                className={`tab ${tab === id ? 'active' : ''}`}
                aria-pressed={tab === id}
                key={id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {screen === 'organization' && tab === 'profile' ? (
            <section className="grid-2">
              <div className="panel">
                <header className="panel-head">
                  <div className="panel-title">
                    <Building2 size={20} />
                    اطلاعات پایه و نقش‌ها
                  </div>
                  <button
                    className="btn small"
                    disabled={!canEdit}
                    onClick={onEdit}
                  >
                    ویرایش اطلاعات
                  </button>
                </header>
                <div className="panel-body summary-list">
                  {[
                    ['نام سازمان', organization.name],
                    ['شناسه ملی', 'در دسترس نیست'],
                    [
                      'نوع شخصیت',
                      organization.attributes.personType === 'LEGAL'
                        ? 'حقوقی'
                        : organization.attributes.personType === 'NATURAL'
                          ? 'حقیقی'
                          : 'ثبت‌نشده',
                    ],
                    [
                      'نقش فعال',
                      cooperationLabel(organization.attributes.roleCodes),
                    ],
                    ['کد سازمان', organization.code],
                    [
                      'آخرین تغییر',
                      new Date(organization.updatedAt).toLocaleDateString(
                        'fa-IR',
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div className="summary-row" key={String(label)}>
                      <span>{label}</span>
                      <b>{String(value ?? '—')}</b>
                    </div>
                  ))}
                </div>
              </div>
              {operations('profile')}
            </section>
          ) : screen === 'organization' && tab === 'representatives' ? (
            <section className="panel">
              <header className="panel-head">
                <div>
                  <div className="panel-title">
                    <Users size={20} />
                    نمایندگان سازمان
                  </div>
                  <div className="panel-note">
                    اطلاعات تماس به‌صورت پوشیده نمایش داده می‌شوند.
                  </div>
                </div>
              </header>
              <div className="panel-body">{contacts}</div>
            </section>
          ) : screen === 'contracts' && tab === 'documents' ? (
            <OrganizationDocumentsPanel
              key={organization.id}
              organization={organization}
            />
          ) : operationalView ? (
            operations(operationalView)
          ) : (
            <CorporateUnavailable
              title={current?.tabs.find(([id]) => id === tab)?.[1] ?? title}
              description={
                screen === 'finance'
                  ? 'اطلاعات مالی هنوز در دسترس نیست؛ صورت‌حساب و تسویه پس از اتصال سرویس مالی نمایش داده می‌شوند.'
                  : screen === 'credit'
                    ? 'ثبت و تأیید درخواست اعتبار و تضمین هنوز آماده نیست.'
                    : screen === 'access'
                      ? 'دسترسی کاربران این سازمان هنوز به سامانه هویت و تأیید متصل نشده است.'
                      : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
