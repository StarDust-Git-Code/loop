/** Loopmates logo: two linked loops (a Loop and its mate) + wordmark. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="lm-weave"><rect x="25" y="38" width="14" height="18" /></clipPath>
      </defs>
      <circle cx="24" cy="32" r="16" stroke="#6A4DF4" strokeWidth="8" />
      <circle cx="40" cy="32" r="16" stroke="#15121A" strokeWidth="8" />
      <circle cx="24" cy="32" r="16" stroke="#6A4DF4" strokeWidth="8" clipPath="url(#lm-weave)" />
    </svg>
  );
}

export default function Logo({ size = 34, fontSize = 26 }: { size?: number; fontSize?: number }) {
  return (
    <>
      <LogoMark size={size} />
      <b className="logo-word" style={{ fontSize }}>
        loop<em>mates</em>
      </b>
    </>
  );
}
