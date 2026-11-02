import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MySpace } from '../../components/screens/MySpace';

export const metadata: Metadata = { title: 'My Space' };

export default function Page() {
  return (
    <Suspense>
      <MySpace />
    </Suspense>
  );
}
