import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skills } from '../../components/screens/Skills';

export const metadata: Metadata = { title: 'Skills' };

export default function Page() {
  return (
    <Suspense>
      <Skills />
    </Suspense>
  );
}
