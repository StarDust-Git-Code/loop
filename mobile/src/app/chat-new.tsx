import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { mateName } from '../lib/mates';

/** Opened by the home-screen widget: starts a fresh chat with a Mate and goes straight into it. */
export default function ChatNew() {
  const { mate = 'planner' } = useLocalSearchParams<{ mate?: string }>();
  const [id, setId] = useState<string | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { api.conversations.create({ title: `Chat with ${mateName(mate)}`, mate: mate as never, messages: [], mode: 'chat', members: [] }).then((c) => setId(c.id)).catch(() => setFailed(true)); }, [mate]);
  if (failed) return <Redirect href="/" />;
  return id ? <Redirect href={`/chat/${id}`} /> : null;
}
