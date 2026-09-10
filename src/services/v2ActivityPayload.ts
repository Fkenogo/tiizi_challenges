/**
 * Phase C3B V2 activity payload construction (pure, UI-testable).
 *
 * The client sends ONLY legitimate Evidence inputs. Points, scores, Derived
 * Truth, member identity, Knowledge/config versions are server-derived and
 * must never appear in a V2 payload — the server rejects them.
 */
import type { V2ActivityPayload } from '../api/v2ChallengeApi';

/** Structural API failure shape (matches ApiError without importing Firebase). */
interface V2ApiFailure {
  status: number;
  code?: string;
}

function asApiFailure(error: unknown): V2ApiFailure | null {
  if (typeof error !== 'object' || error === null) return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number') return null;
  const code = (error as { code?: unknown }).code;
  return { status, code: typeof code === 'string' ? code : undefined };
}

export interface V2LogInput {
  activityKind: 'fitness' | 'wellness';
  canonicalKey: string;
  activityVariant?: string | null;
  value: number;
  unit: string;
  /** Truthful occurrence time (selected time, else intentional logging time). */
  occurredAt: Date;
  clientKey: string;
}

/** Build the exact C2B payload. Throws on invalid inputs (fail fast, no send). */
export function buildV2ActivityPayload(input: V2LogInput): V2ActivityPayload {
  if (input.activityKind !== 'fitness' && input.activityKind !== 'wellness') {
    throw new Error('activityKind must be fitness|wellness');
  }
  if (!input.canonicalKey || input.canonicalKey.length > 200) {
    throw new Error('canonicalKey is required (1..200 chars)');
  }
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error('value must be a positive number');
  }
  if (!input.unit || input.unit.length > 40) {
    throw new Error('unit is required (1..40 chars)');
  }
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) {
    throw new Error('occurredAt must be a valid Date');
  }
  if (!input.clientKey || input.clientKey.length > 300) {
    throw new Error('clientKey is required (1..300 chars)');
  }
  const { occurred_at, occurred_day, occurred_tz } = resolveOccurrence(input.occurredAt);
  const payload: V2ActivityPayload = {
    activity_kind: input.activityKind,
    canonical_key: input.canonicalKey,
    value: input.value,
    unit: input.unit,
    occurred_at,
    occurred_day,
    client_key: input.clientKey,
  };
  if (input.activityVariant) payload.activity_variant = input.activityVariant;
  if (occurred_tz) payload.occurred_tz = occurred_tz;
  return payload;
}

/**
 * One unique client_key per intentional logging action. crypto.randomUUID
 * where available; explicit random fallback otherwise. Never timestamps
 * alone. Callers generate ONE key per intentional action and reuse it across
 * automatic/manual retries of THAT submission; a new intentional action
 * always generates a new key.
 */
export function newClientKey(): string {
  try {
    const cryptoRef =
      (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto) || undefined;
    if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
      return `v2-${cryptoRef.randomUUID()}`;
    }
  } catch {
    // Fall through to the explicit fallback below.
  }
  const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
    + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `v2-${Date.now().toString(36)}-${random}`;
}

export interface OccurrenceFields {
  occurred_at: string;
  occurred_day: string;
  occurred_tz?: string;
}

/** Truthful occurrence fields: ISO timestamp, local calendar day, IANA tz. */
export function resolveOccurrence(at: Date): OccurrenceFields {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timeZone = undefined;
  }
  let day: string;
  try {
    day = timeZone
      ? at.toLocaleDateString('en-CA', { timeZone })
      : at.toISOString().slice(0, 10);
  } catch {
    day = at.toISOString().slice(0, 10);
  }
  const fields: OccurrenceFields = {
    occurred_at: at.toISOString(),
    occurred_day: day,
  };
  if (timeZone) fields.occurred_tz = timeZone;
  return fields;
}

/**
 * Map V2 API failures to displayable messages. NEVER fall back to V1
 * writes: a failed V2 request stays failed/retryable.
 */
export function mapV2ApiError(error: unknown): { message: string; retryable: boolean } {
  const failure = asApiFailure(error);
  if (failure) {
    switch (failure.status) {
      case 401:
        return { message: 'Please sign in again to continue.', retryable: false };
      case 403:
        return { message: 'Only current group members can log here right now.', retryable: false };
      case 404:
        return { message: 'This challenge is no longer available.', retryable: false };
      case 409:
        return { message: 'Already recorded — no duplicate was created.', retryable: false };
      case 422:
        return { message: `Could not log this activity (${failure.code ?? 'invalid'}).`, retryable: false };
      case 503:
        return { message: 'Service temporarily unavailable. You can retry.', retryable: true };
      default:
        return { message: 'Something went wrong. You can retry.', retryable: failure.status >= 500 };
    }
  }
  if (error instanceof Error && /unreachable|network|fetch|failed/i.test(error.message)) {
    return { message: 'Connection issue. You can retry — your entry is kept.', retryable: true };
  }
  return { message: error instanceof Error ? error.message : 'Something went wrong.', retryable: false };
}
