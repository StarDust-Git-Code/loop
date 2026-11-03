import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Call } from '../../components/screens/Call';

export const metadata: Metadata = { title: 'Call' };

export default function Page() {
  return (
    <Suspense>
      <Call />
    </Suspense>
  );
}
