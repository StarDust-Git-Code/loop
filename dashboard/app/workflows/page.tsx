import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Workflows } from '../../components/screens/Workflows';

export const metadata: Metadata = { title: 'Workflows' };

export default function Page() {
  return (
    <Suspense>
      <Workflows />
    </Suspense>
  );
}
