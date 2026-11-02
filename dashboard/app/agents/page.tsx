import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Agents } from '../../components/screens/Agents';

export const metadata: Metadata = { title: 'Agents' };

export default function Page() {
  return (
    <Suspense>
      <Agents />
    </Suspense>
  );
}
