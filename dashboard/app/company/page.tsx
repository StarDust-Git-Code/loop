import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Company } from '../../components/screens/Company';

export const metadata: Metadata = { title: 'Company' };

export default function Page() {
  return (
    <Suspense>
      <Company />
    </Suspense>
  );
}
