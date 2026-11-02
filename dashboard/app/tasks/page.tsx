import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Tasks } from '../../components/screens/Tasks';

export const metadata: Metadata = { title: 'Tasks' };

export default function Page() {
  return (
    <Suspense>
      <Tasks />
    </Suspense>
  );
}
