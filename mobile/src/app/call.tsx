import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep links such as loopmates://call?mate=research&reason=... land here and open the Call page. */
export default function CallLink() {
  const p = useLocalSearchParams<{ mate?: string; reason?: string; conv?: string }>();
  return <Redirect href={{ pathname: '/', params: { tab: 'call', mate: p.mate, reason: p.reason, conv: p.conv } }} />;
}
