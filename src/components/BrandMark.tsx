/** Inline SVG version of the PolyStats mark: purple square-font italic P. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <g fill="#8b7cf0" transform="skewX(-8)" style={{ transformOrigin: '32px 32px' }}>
        <path d="M22 8h9v48h-9z" />
        <path d="M22 8h16c8 0 13 4.5 13 11s-5 11-13 11h-7v-9h6.5c2.3 0 3.5-1 3.5-2s-1.2-2-3.5-2H31V8z" />
      </g>
    </svg>
  );
}
