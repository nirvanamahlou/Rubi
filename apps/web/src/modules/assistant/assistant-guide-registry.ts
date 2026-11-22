import callCenter from '../../../../../services/assistant/call-center-guides.json';
import workbench from '../../../../../services/assistant/workbench-guides.json';
import b2c from './customer-guide-catalog.json';
import sales from './contract-guide.generated.json';
import panels from './linked-panel-guides.generated.json';

interface Section {
  id: string;
  title: string;
  href: string;
  guideHref: string;
  related: string[];
  steps: string[];
  route?: string[];
  path?: string[];
  conditions?: string[];
}

export const assistantGuideCatalogues = {
  ...panels,
  sales: { title: 'راهنمای قراردادهای فروش', topics: sales.topics },
  workbench: { title: 'راهنمای میزکار من', topics: workbench.topics },
  'call-center': { title: 'راهنمای کال‌سنتر', topics: callCenter.topics },
  b2c: { title: 'راهنمای مشتریان حقیقی', topics: b2c },
} satisfies Record<string, { title: string; topics: Section[] }>;

export type AssistantGuideModule = keyof typeof assistantGuideCatalogues;

export function isAssistantGuideModule(
  domain: string,
): domain is AssistantGuideModule {
  return Object.hasOwn(assistantGuideCatalogues, domain);
}

export function assistantGuideSection(
  domain: AssistantGuideModule,
  id?: string,
): Section | undefined {
  return assistantGuideCatalogues[domain].topics.find((item) => item.id === id);
}

export function documentGuideLink(
  link: { href: string; label: string },
  domain: AssistantGuideModule,
  id?: string,
) {
  const section = assistantGuideSection(domain, id);
  return section ? { ...link, guideHref: section.guideHref } : link;
}
