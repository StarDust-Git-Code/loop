import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Files } from '../../components/screens/Files';

export const metadata: Metadata = { title: 'Files' };

export default function Page() {
  return (
    <Suspense>
      <Files />
    </Suspense>
  );
}
