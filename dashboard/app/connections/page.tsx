import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Connections } from '../../components/screens/Connections';

export const metadata: Metadata = { title: 'Connections' };

export default function Page() {
  return (
    <Suspense>
      <Connections />
    </Suspense>
  );
}
