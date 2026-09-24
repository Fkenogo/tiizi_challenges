/**
 * Resolve which product-generation route owns the current browser location.
 * V1 and V2 are sibling route trees; shared legacy runtime work must only
 * run inside the explicit /app route family.
 */
export function routeProductGeneration(pathname) {
  if (pathname === '/v2' || pathname.startsWith('/v2/')) return 'v2';
  if (pathname === '/app' || pathname.startsWith('/app/')) return 'v1';
  return 'public';
}
