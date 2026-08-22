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

export function getNavigationItem(pathname: string) {
  return navigationItems.find((item) => item.href === pathname);
}
