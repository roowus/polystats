/** Inline SVG version of the PolyStats mark for the navbar. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M-4 46h34l-4 6H-8zM-8 54h30l-4 6H-12z" fill="#2e4182" />
      <path d="M14 8h34l-8 48H6z" fill="#112052" stroke="#ffffff" strokeWidth="2.5" />
      <path
        d="M26 16h10c6 0 9.5 3.8 9.5 8.6 0 5-3.7 8.7-9.8 8.7H33l-1.4 8.7h-6.4L26 16zm6 4.4 1.1 8.6h2.7c2.7 0 4.3-1.7 4.3-4.2 0-2.7-1.8-4.4-4.6-4.4H32z"
        fill="#ffffff"
      />
    </svg>
  );
}
