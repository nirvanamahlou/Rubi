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
  HeartHandshake,
  Megaphone,
  PackageSearch,
  Settings,
  SlidersHorizontal,
  UserRoundCog,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

import { navigationMessages, type NavigationHref } from '../messages/fa';

const iconByHref: Record<NavigationHref, LucideIcon> = {
  '/dashboard': Gauge,
  '/customers': UsersRound,
  '/sales': Waypoints,
  '/reservations': CalendarCheck2,
  '/customer-service': Headphones,
  '/purchases': PackageSearch,
  '/finance': CircleDollarSign,
  '/marketing': Megaphone,
  '/organizations': Building2,
  '/human-resources': HeartHandshake,
  '/tasks': Bot,
  '/documents': FileStack,
  '/reports': BarChart3,
  '/integrations': SlidersHorizontal,
  '/users': UserRoundCog,
  '/master-data': ClipboardList,
  '/settings': Settings,
};

export const navigationItems = navigationMessages.map((item) => ({
  ...item,
  icon: iconByHref[item.href],
}));

export function getNavigationItem(pathname: string) {
  return navigationItems.find((item) => item.href === pathname);
}
