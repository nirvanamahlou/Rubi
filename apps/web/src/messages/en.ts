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
  '/customers': { title: 'Customers & travelers', description: 'Customer records' },
  '/customer-affairs': { title: 'Customer service & support', description: 'Customer requests' },
  '/reservations': { title: 'Reservations & travel operations', description: 'Travel services' },
  '/reservations/hotel-rates': { title: 'Bulk hotel rates', description: 'Hotel purchase rates' },
  '/ticket-management': { title: 'Ticket management', description: 'Schedules, fares & capacity' },
  '/sales': { title: 'Contracts', description: 'Contracts and traveler allocation' },
  '/purchases': { title: 'Purchasing & procurement', description: 'Services and suppliers' },
  '/finance': { title: 'Accounting', description: 'Accounting & treasury' },
  '/finance/requests': { title: 'Payment requests', description: 'Payment and receipt requests' },
  '/marketing': { title: 'Marketing', description: 'Campaigns and audiences' },
  '/organizations': { title: 'Agencies & corporate customers', description: 'Corporate accounts' },
  '/human-resources': { title: 'Human resources', description: 'Employee operations' },
  '/documents': { title: 'Documents & files', description: 'File archive' },
  '/reports': { title: 'Reports', description: 'Management reports' },
  '/integrations': { title: 'Integrations', description: 'Services and providers' },
  '/system': { title: 'System management', description: 'System settings' },
  '/master-data': { title: 'Master data', description: 'Reference data' },
};

export const englishNavigationGroups: Record<string, string> = {
  work: 'Workspace',
  sales: 'Sales & customer relations',
  operations: 'Reservations & travel supply',
  finance: 'Finance',
  hr: 'Human resources',
  resources: 'Documents & reports',
  system: 'Company settings',
};

export function englishNavigationTitle(href: string, fallback: string) {
  if (href === '/sales/pricing') return 'Pricing & packages';
  return englishNavigation[href as NavigationHref]?.title ?? fallback;
}
