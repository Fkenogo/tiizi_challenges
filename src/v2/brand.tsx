/**
 * TIIZI S1 — V2 brand carry-forward (Class A: BRAND ASSET).
 *
 * Reuses approved Tiizi brand identity only:
 * - orange-led identity (--primary #ff6b00, --primary-dark #e65100)
 * - Lexend typography (global index.css)
 * - approved static assets under public/ (favicon/app icons/logo)
 *
 * This module introduces no new brand design and imports no V1
 * experience components. Asset paths reference public/ directly so
 * bundled output keeps using the approved files.
 */

export const V2_BRAND = {
  name: 'tiizi',
  tagline: 'Together We Move',
  /** Approved app icon (also used as favicon). */
  markSrc: '/favicon.png',
  /** Approved touch icon. */
  touchIconSrc: '/apple-touch-icon.png',
  /** Approved vector/raster logo stock (filename contains a space; kept as-is). */
  logoStockSrc: '/logo-icon/Tiizi -iconlogo.png',
} as const;

export function V2BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center overflow-hidden rounded-xl bg-primary text-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <img
        src={V2_BRAND.markSrc}
        alt=""
        width={Math.round(size * 0.72)}
        height={Math.round(size * 0.72)}
        draggable={false}
      />
    </span>
  );
}
