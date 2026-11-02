import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Schedule } from '../../components/screens/Schedule';

export const metadata: Metadata = { title: 'Schedule' };

export default function Page() {
  return (
    <Suspense>
      <Schedule />
    </Suspense>
  );
}
