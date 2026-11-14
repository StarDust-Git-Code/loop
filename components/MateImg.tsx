import Image from "next/image";
import { mateSrc, type MateKey } from "@/lib/mates";

/** A Mate mascot. Decorative by default: the name is always written next to it. */
export default function MateImg({
  k,
  size,
  className,
}: {
  k: MateKey;
  /** Largest CSS size it is drawn at, in px. */
  size: number;
  className?: string;
}) {
  return (
    <Image
      className={className}
      src={mateSrc(k)}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      draggable={false}
    />
  );
}
