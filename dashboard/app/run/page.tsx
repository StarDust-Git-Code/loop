import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Run } from '../../components/screens/Run';

export const metadata: Metadata = { title: 'Runs' };

export default function Page() {
  return (
    <Suspense>
      <Run />
    </Suspense>
  );
}
