'use client';

import {
  canViewRoute,
  visibleIntegrationSections,
  type AuthenticatedActor,
} from '@nora/contracts';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Cable,
  FileCheck2,
  Globe2,
  Hotel,
  MapPin,
  Plane,
  Check,
  Tags,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/surfaces';
import Link from '@/i18n/link';
import { useUiTranslation } from '@/i18n/locale-context';
import {
  canPublishWebsiteView,
  commerceWebsites,
  publicationViews,
  type CommerceWebsiteCode,
  type PublicationView,
} from '../site-publication-model';
import styles from './site-management.module.css';
import { SiteManagement } from './site-management';

const publicationDetails = {
  tours: { icon: Tags, detail: 'دوره‌های سفر، نرخ‌ها و وضعیت انتشار تور' },
  tickets: {
    icon: Plane,
    detail: 'پروازهای یک‌طرفه، رفت‌وبرگشت و انتشار گروهی',
  },
  hotels: { icon: Hotel, detail: 'پروفایل هتل، امکانات و تصاویر' },
  countries: { icon: Globe2, detail: 'پروفایل کشور، پرچم و تصاویر' },
  cities: { icon: MapPin, detail: 'پروفایل شهر و تصاویر مقصد' },
  'visa-services': {
    icon: FileCheck2,
    detail: 'پروفایل خدمات ویزا و شرایط آن',
  },
} satisfies Record<PublicationView, { icon: typeof Globe2; detail: string }>;

const managementGroups = [
  {
    title: 'مشتری و پشتیبانی',
    icon: Building2,
    links: [
      { title: 'پرونده خریداران و مسافران', href: '/customers' },
      {
        title: 'تیکت‌ها و درخواست‌های خدمات',
        href: '/customer-affairs?section=tickets',
      },
      {
        title: 'سرنخ‌های مارکتینگ',
        href: '/marketing?section=audiences&tab=leads',
      },
      { title: 'حساب آژانس‌ها و شرایط همکاری', href: '/organizations' },
    ],
  },
] as const;

export function WebsiteManagementWorkspace({
  actor,
  ticketLink,
  initialSite,
  onOpenConnection,
}: {
  actor: AuthenticatedActor;
  ticketLink?: URLSearchParams | undefined;
  initialSite?: CommerceWebsiteCode | undefined;
  onOpenConnection: (site: CommerceWebsiteCode) => void;
}) {
  const t = useUiTranslation();
  const [site, setSite] = useState<CommerceWebsiteCode>(initialSite ?? 'nss');
  const [publication, setPublication] = useState<
    PublicationView | null | undefined
  >();
  const website =
    commerceWebsites.find((item) => item.code === site) ?? commerceWebsites[0];
  const canOpenConnection = visibleIntegrationSections(
    actor.permissions,
  ).includes('connections');
  const showDeepLink = publication === undefined && ticketLink !== undefined;
  const visiblePublications = publicationViews.filter(({ id }) =>
    canPublishWebsiteView(actor.permissions, id),
  );

  if (showDeepLink || publication)
    return (
      <section className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setPublication(null)}>
            {t('بازگشت به مدیریت سایت')}
          </Button>
          {!showDeepLink && (
            <a
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('باز کردن سایت')} · {t(website.name)}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          )}
        </div>
        <SiteManagement
          actor={actor}
          initialView={publication ?? undefined}
          ticketLink={showDeepLink ? ticketLink : undefined}
          site={showDeepLink ? undefined : site}
        />
      </section>
    );

  return (
    <section className="grid min-w-0 gap-6">
      <PageHeader title={t('مدیریت سایت')} />
      <div
        className="grid gap-3 sm:grid-cols-3"
        role="group"
        aria-label={t('انتخاب سایت برای مدیریت')}
      >
        {commerceWebsites.map((item) => (
          <article
            key={item.code}
            data-site={item.code}
            data-selected={item.code === site}
            className={styles.siteCard}
          >
            <button
              type="button"
              aria-pressed={item.code === site}
              onClick={() => setSite(item.code)}
              className="flex min-w-0 items-center gap-3 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className={styles.siteIcon}>
                <Globe2 aria-hidden="true" className="size-5" />
              </span>
              <span className="grid min-w-0 gap-1">
                <strong>{t(item.name)}</strong>
                <bdi className="break-all text-xs font-normal text-muted-foreground">
                  {new URL(item.url).hostname}
                </bdi>
              </span>
              {item.code === site && (
                <Check aria-hidden="true" className={styles.selectedMark} />
              )}
            </button>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('باز کردن سایت')} ${t(item.name)}`}
              className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('باز کردن سایت')}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </article>
        ))}
      </div>

      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-bold">{t(website.name)}</h2>
            <p className="text-sm text-muted-foreground">
              {t('مقصد انتخاب‌شده برای انتشار')}
            </p>
          </div>
          {canOpenConnection && (
            <Button variant="outline" onClick={() => onOpenConnection(site)}>
              <Cable aria-hidden="true" className="size-4" />
              {t('اتصال و پنل سایت')}
            </Button>
          )}
        </div>
        {visiblePublications.length > 0 && (
          <div className="grid gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-bold text-primary">
              {t('انتشار در سایت')}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visiblePublications.map(({ id, label }) => {
                const { icon: Icon, detail } = publicationDetails[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPublication(id)}
                    className={styles.categoryCard}
                  >
                    <Icon aria-hidden="true" className={styles.categoryIcon} />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <strong className="text-sm">{t(label)}</strong>
                      <small className="text-xs leading-relaxed text-muted-foreground">
                        {t(detail)}
                      </small>
                    </span>
                    <ArrowLeft
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground ltr:rotate-180"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
      <div className="grid gap-4">
        {managementGroups.map(({ title, icon: Icon, links }) => {
          const visible = links.filter(({ href }) =>
            canViewRoute(actor.permissions, href),
          );
          if (!visible.length) return null;
          return (
            <section
              key={title}
              className="grid content-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5"
            >
              <h2 className="flex items-center gap-2 font-bold">
                <Icon aria-hidden="true" className="size-5 text-primary" />
                {t(title)}
              </h2>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {visible.map(({ title: linkTitle, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-md text-sm text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="flex-1">{t(linkTitle)}</span>
                      <ArrowLeft
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground ltr:rotate-180"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
