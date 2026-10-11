/**
 * MC-1 — V2-only display-name normalisation (pure, no Firebase import).
 *
 * Mirrors the bootstrap API's transport/storage safety bound (trim, NFC,
 * 1–120 code points, no control characters). It is NOT Product Truth. A value
 * that would be rejected is omitted (returns null) so a bad Firebase name can
 * never lock an account out of the V2 shell; the member is then created with
 * no canonical name and meets the governed completion gate later. Never
 * derives anything from email.
 */
export const V2_DISPLAY_NAME_MAX_LENGTH = 120;

export function normalizeV2DisplayName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().normalize('NFC');
  if (name.length === 0) return null;
  if ([...name].length > V2_DISPLAY_NAME_MAX_LENGTH) return null;
  if (/\p{Cc}/u.test(name)) return null;
  return name;
}

/** True when a non-empty name exceeds the bound, counted in Unicode code points. */
export function isV2DisplayNameTooLong(raw: string): boolean {
  return [...raw.trim().normalize('NFC')].length > V2_DISPLAY_NAME_MAX_LENGTH;
}
