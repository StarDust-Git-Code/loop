import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Chat } from '../../components/screens/Chat';

export const metadata: Metadata = { title: 'Chat' };

export default function Page() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
