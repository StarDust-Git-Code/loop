import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Studio } from '../../components/screens/Studio';

export const metadata: Metadata = { title: 'Studio' };

export default function Page() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}
