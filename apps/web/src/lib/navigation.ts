import {
  BarChart3,
  Bot,
  Building2,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  FileStack,
  Gauge,
  Headphones,
  Handshake,
  HeartHandshake,
  Megaphone,
  PackageSearch,
  Settings,
  SlidersHorizontal,
  Ticket,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import { navigationMessages, type NavigationHref } from '../messages/fa';
import { getMasterDataSection } from '../modules/master-data/model/sections';

const iconByHref: Record<NavigationHref, LucideIcon> = {
  '/dashboard': Gauge,
  '/customers': UsersRound,
  '/customer-affairs': Headphones,
  '/reservations': CalendarCheck2,
  '/ticket-management': Ticket,
  '/sales': Handshake,
  '/purchases': PackageSearch,
  '/finance': CircleDollarSign,
  '/marketing': Megaphone,
  '/organizations': Building2,
  '/human-resources': HeartHandshake,
  '/tasks': Bot,
  '/documents': FileStack,
  '/reports': BarChart3,
  '/integrations': SlidersHorizontal,
  '/system': Settings,
  '/master-data': ClipboardList,
};

export const navigationItems = navigationMessages.map((item) => ({
  ...item,
  icon: iconByHref[item.href],
}));

export const navigationAliases = {
  '/users': {
    parentHref: '/system',
    title: 'مدیریت کاربران، نقش‌ها و دسترسی‌ها',
  },
  '/settings': {
    parentHref: '/system',
    title: 'تنظیمات سامانه',
  },
} as const satisfies Record<
  string,
  { parentHref: NavigationHref; title: string }
>;

export function getNavigationItem(pathname: string) {
  const direct = navigationItems.find((item) => item.href === pathname);
  if (direct) return direct;

  const alias = navigationAliases[pathname as keyof typeof navigationAliases];
  if (alias)
    return navigationItems.find((item) => item.href === alias.parentHref);

  return navigationItems.find((item) => pathname.startsWith(`${item.href}/`));
}

export function isNavigationItemActive(href: NavigationHref, pathname: string) {
  return getNavigationItem(pathname)?.href === href;
}

export function getNavigationBreadcrumbs(pathname: string) {
  if (pathname.startsWith('/master-data/')) {
    const sectionSlug = pathname.slice('/master-data/'.length).split('/')[0];
    const section = getMasterDataSection(sectionSlug ?? '');
    const parent = navigationItems.find((item) => item.href === '/master-data');
    if (section) {
      return [
        ...(parent ? [{ href: parent.href, title: parent.title }] : []),
        {
          href: `/master-data/${section.slug}`,
          title: section.title,
        },
      ];
    }
  }

  const alias = navigationAliases[pathname as keyof typeof navigationAliases];
  if (alias) {
    const parent = navigationItems.find(
      (item) => item.href === alias.parentHref,
    );
    return [
      ...(parent ? [{ href: parent.href, title: parent.title }] : []),
      { href: pathname, title: alias.title },
    ];
  }

  const current = navigationItems.find((item) => item.href === pathname);
  return current ? [{ href: current.href, title: current.title }] : [];
}
