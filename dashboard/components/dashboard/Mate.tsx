import { mateImg } from '../../lib/mates';
import type { MateKey } from '../../lib/types';

/** Decorative Mate cut-out. Names are always rendered as text next to it. */
export function Mate({ mate, size, className }: { mate: MateKey; size: number; className?: string }) {
   
  return <img src={mateImg(mate)} alt="" width={size} height={size} className={className} style={{ width: size, height: size, flex: 'none', objectFit: 'contain' }} />;
}
