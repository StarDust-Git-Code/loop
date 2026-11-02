import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Automations } from '../../components/screens/Automations';

export const metadata: Metadata = { title: 'Automations' };

export default function Page() {
  return (
    <Suspense>
      <Automations />
    </Suspense>
  );
}
