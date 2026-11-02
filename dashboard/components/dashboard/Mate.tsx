import Image from 'next/image';
import { MATES, type MateKey } from '../../lib/dashboard/data';

type Props = { mate: MateKey; size: number; className?: string };

/** Decorative Mate cut-out. Names are always rendered as text next to it. */
export function Mate({ mate, size, className }: Props) {
  return (
    <Image
      src={MATES[mate].src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, flex: 'none', objectFit: 'contain' }}
    />
  );
}
