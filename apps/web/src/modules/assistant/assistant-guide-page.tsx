'use client';

import { useEffect } from 'react';
import Link from '@/i18n/link';
import { useAccessActor, useRouteAccess } from '@/modules/iam/access-context';
import {
  assistantGuideCatalogues as catalogues,
  assistantGuideSection,
  isAssistantGuideModule,
  type AssistantGuideModule,
} from './assistant-guide-registry';

export function AssistantGuidePage({
  module,
}: {
  module: AssistantGuideModule;
}) {
  const actor = useAccessActor();
  const canOpen = useRouteAccess();
  useEffect(() => {
    if (!actor || !window.location.hash) return;
    const fragment = window.location.hash.slice(1);
    document.getElementById(fragment)?.scrollIntoView();
  }, [actor, canOpen, module]);
  if (!actor) return null;
  const catalogue = catalogues[module];
  const topics = catalogue.topics.flatMap(({ id }) => {
    const section = assistantGuideSection(module, id);
    return section && canOpen(section.href) ? [section] : [];
  });
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6" dir="rtl">
      <h1 className="text-2xl font-bold">{catalogue.title}</h1>
      {topics.map((topic) => (
        <section
          className="scroll-mt-20 space-y-3 rounded-xl border p-4"
          id={topic.id}
          key={topic.id}
        >
          <h2 className="text-lg font-semibold">{topic.title}</h2>
          {(topic.route || topic.path) && (
            <p>{(topic.route ?? topic.path)?.join(' ← ')}</p>
          )}
          <ul className="list-disc ps-6">
            {topic.conditions?.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
          <ol className="list-decimal space-y-1 ps-6">
            {topic.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Link className="block underline" href={topic.href}>
            باز کردن پنل
          </Link>
          {topic.related.map((ref) => {
            const [domain, id] = ref.split('/');
            if (!domain || !isAssistantGuideModule(domain)) return null;
            const related = assistantGuideSection(domain, id);
            return related && canOpen(related.href) ? (
              <Link
                className="block underline"
                href={related.guideHref}
                key={ref}
              >
                {related.title}
              </Link>
            ) : null;
          })}
        </section>
      ))}
    </main>
  );
}
