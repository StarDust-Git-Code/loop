import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FitScreen } from '../../components/dashboard/FitScreen';
import { SCREENS } from '../../lib/dashboard/screens';

type Params = { screen: string };

export function generateStaticParams(): Params[] {
  return Object.keys(SCREENS).map((screen) => ({ screen }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { screen } = await params;
  return { title: SCREENS[screen]?.title };
}

export default async function ScreenPage({ params }: { params: Promise<Params> }) {
  const { screen } = await params;
  const def = SCREENS[screen];
  if (!def) notFound();
  const html = fs.readFileSync(path.join(process.cwd(), 'components/dashboard/screens', `${screen}.html`), 'utf8');
  return <FitScreen html={html} links={def.links} />;
}
