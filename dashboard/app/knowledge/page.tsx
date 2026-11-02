import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Knowledge } from '../../components/screens/Knowledge';

export const metadata: Metadata = { title: 'Knowledge' };

export default function Page() {
  return (
    <Suspense>
      <Knowledge />
    </Suspense>
  );
}
