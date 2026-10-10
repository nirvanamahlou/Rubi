import type { NavigationHref } from './fa';

export const enMessages = {
  common: {
    search: 'Global search',
    searchHint: 'Search for a customer, order, or section',
    close: 'Close',
    unavailable: 'Unavailable',
  },
  shell: {
    workspace: 'CRM workspace',
    language: 'Language',
    persian: 'Persian',
    english: 'English',
    lightTheme: 'Light theme',
    darkTheme: 'Dark theme',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    openNavigation: 'Open main navigation',
  },
} as const;

export const englishNavigation: Record<
  NavigationHref,
  { description: string; title: string }
> = {
  '/workbench': { title: 'My workspace', description: 'My tasks and files' },
  '/dashboard': { title: 'Dashboard', description: 'Performance overview' },
  '/customers': {
    title: 'B2c customers',
    description: 'Customer records',
  },
  '/customer-affairs': {
    title: 'Customer service & support',
    description: 'Customer requests',
  },
  '/reservations': {
    title: 'Reservations',
    description: 'Travel services',
  },
  '/reservations/hotel-rates': {
    title: 'Hotel purchase rates',
    description: 'Hotel purchase rates',
  },
  '/ticket-management': {
    title: 'Ticket management',
    description: 'Schedules, fares & capacity',
  },
  '/sales': {
    title: 'Contracts',
    description: 'Contracts and traveler allocation',
  },
  '/purchases': {
    title: 'Petty cash',
    description: 'Services and suppliers',
  },
  '/ticket-purchases': {
    title: 'Purchasing & supply',
    description: 'Flight purchase costs and airline settlement',
  },
  '/finance': { title: 'Accounting', description: 'Accounting & treasury' },
  '/finance/requests': {
    title: 'Payment requests',
    description: 'Payment and receipt requests',
  },
  '/marketing': { title: 'Marketing', description: 'Campaigns and audiences' },
  '/organizations': {
    title: 'B2B customers',
    description: 'Corporate accounts',
  },
  '/human-resources': {
    title: 'Human resources',
    description: 'Employee operations',
  },
  '/correspondence': {
    title: 'Correspondence',
    description: 'Letter composer and PNG/PDF exports',
  },
  '/documents': { title: 'Documents & files', description: 'File archive' },
  '/reports': { title: 'Reports', description: 'Management reports' },
  '/integrations': {
    title: 'Integrations',
    description: 'Services and providers',
  },
  '/system': { title: 'System management', description: 'System settings' },
  '/master-data': { title: 'Master data', description: 'Reference data' },
};

export const englishNavigationGroups: Record<string, string> = {
  work: 'Workspace',
  sales: 'Sales & customer relations',
  operations: 'Reservations',
  finance: 'Finance',
  'ticket-purchases': 'Purchasing & supply',
  hr: 'Human resources',
  resources: 'Documents & reports',
  correspondence: 'Correspondence',
  system: 'Company settings',
};

export function englishNavigationTitle(href: string, fallback: string) {
  if (href === '/sales/ticket-prices') return 'Flight pricing';
  if (href === '/sales/pricing') return 'Package management';
  return englishNavigation[href as NavigationHref]?.title ?? fallback;
}
