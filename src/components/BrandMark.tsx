/** Inline SVG version of the PolyStats mark (italic P, transparent bg). */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 72 52" aria-hidden>
      <path d="M2 38h30l-2.5 6H-.5zM-2 46h26l-2.5 6H-4.5z" fill="#2e4182" opacity="0.9" />
      <path
        d="M30 2l-9 48h12l3-17h8c9 0 15-5.5 15-14 0-8-6-13-15-13H30zm11 10c4 0 6.5 2 6.5 5.5S45 22.5 41 22.5h-5l1.3-10.5h4.7z"
        fill="#ffffff"
        transform="skewX(-6)"
      />
    </svg>
  );
}
