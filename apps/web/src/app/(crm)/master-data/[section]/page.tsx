import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MasterDataWorkspace } from '@/modules/master-data/components/master-data-live-workspace';
import {
  getMasterDataSection,
  masterDataSections,
} from '@/modules/master-data/model/sections';

export function generateStaticParams() {
  return masterDataSections.map((section) => ({ section: section.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section: slug } = await params;
  const section = getMasterDataSection(slug);
  return {
    title: section ? `${section.title} | اطلاعات پایه` : 'اطلاعات پایه',
  };
}

export default async function MasterDataSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = getMasterDataSection(slug);
  if (!section) notFound();

  return <MasterDataWorkspace section={section} />;
}
