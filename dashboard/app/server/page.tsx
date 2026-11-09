import type { Metadata } from 'next';
import { Server } from '../../components/screens/Server';

export const metadata: Metadata = { title: 'Server' };

export default function Page() {
  return <Server />;
}
