import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Settings } from '../../components/screens/Settings';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
