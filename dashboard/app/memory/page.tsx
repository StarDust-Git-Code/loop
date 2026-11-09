import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Memory } from '../../components/screens/Memory';

export const metadata: Metadata = { title: 'Memory' };

export default function Page() {
  return (
    <Suspense>
      <Memory />
    </Suspense>
  );
}
