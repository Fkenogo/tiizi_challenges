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
  /**
   * CORR-001 (bounded S3b): omit the client-derived `occurred_day` so the
   * server derives the authoritative governing day from `occurred_at` and
   * the pinned Challenge timezone. Default false preserves the existing
   * behavior of frozen/reference surfaces sharing this builder.
   */
  omitOccurredDay?: boolean;
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
  const { occurred_at, occurred_tz } = resolveOccurrence(input.occurredAt);
  const payload: V2ActivityPayload = {
    activity_kind: input.activityKind,
    canonical_key: input.canonicalKey,
    value: input.value,
    unit: input.unit,
    occurred_at,
    client_key: input.clientKey,
  };
  if (!input.omitOccurredDay) {
    payload.occurred_day = resolveOccurrence(input.occurredAt).occurred_day;
  }
  if (input.activityVariant) payload.activity_variant = input.activityVariant;
  if (occurred_tz) payload.occurred_tz = occurred_tz;
  return payload;
}

/**
 * CORR-001 bounded S3b submission builder.
 *
 * The S3b path MUST NOT send a client-derived `occurred_day`: the server
 * derives the authoritative governing day from `occurred_at` and the pinned
 * Challenge timezone. `occurred_tz` is kept as client provenance only. The
 * governing day shown to the participant comes from the authoritative
 * server result (`V2ActivityResult.occurredDay`), never from this payload.
 */
export function buildS3bActivityPayload(input: Omit<V2LogInput, 'omitOccurredDay'>): V2ActivityPayload {
  return buildV2ActivityPayload({ ...input, omitOccurredDay: true });
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

export interface S3bOccurrenceFields {
  occurred_at: string;
  occurred_tz?: string;
}

/**
 * CORR-001 S3b occurrence: ISO timestamp + IANA tz provenance ONLY. No
 * client-derived calendar day leaves the device on the S3b path; the
 * server derives the governing day from `occurred_at` + Challenge timezone.
 */
export function resolveS3bOccurrence(at: Date): S3bOccurrenceFields {
  const { occurred_at, occurred_tz } = resolveOccurrence(at);
  return occurred_tz ? { occurred_at, occurred_tz } : { occurred_at };
}

/**
 * Map V2 API failures to displayable messages. NEVER fall back to V1
 * writes: a failed V2 request stays failed/retryable.
 *
 * S3a: participation denials (join/withdraw) map by server `code` first so
 * members see human-readable governed outcomes; the code is preserved on
 * the result for diagnostics. No implementation/provider terminology
 * reaches members.
 *
 * S3b: activity-application denials (POST /v1/challenges/:id/activity)
 * map the same way. Governed rejections (the server's durable decision
 * that this entry does not count) are NEVER retryable-by-default: the
 * member must change the entry or accept the decision. Retryable marks
 * ONLY infrastructure/service failures where the same entry may succeed
 * on retry (the caller reuses the same client_key).
 */
export function mapV2ApiError(error: unknown): { message: string; retryable: boolean; code?: string } {
  const failure = asApiFailure(error);
  if (failure) {
    switch (failure.code) {
      case 'no_group_membership':
        return {
          message: 'Only current members of the hosting group can take part right now.',
          retryable: false,
          code: failure.code,
        };
      case 'challenge_ended':
        return {
          message: 'This Challenge has ended, so joining is closed.',
          retryable: false,
          code: failure.code,
        };
      case 'participation_exists':
        return {
          message: 'You are already taking part in this Challenge.',
          retryable: false,
          code: failure.code,
        };
      case 'no_active_participation':
        return {
          message: 'You are not currently taking part in this Challenge.',
          retryable: false,
          code: failure.code,
        };
      case 'participation_closed':
        return {
          message: 'This participation is already closed.',
          retryable: false,
          code: failure.code,
        };
      case 'group_authority_unavailable':
        return {
          message: 'We could not confirm group membership right now. You can retry.',
          retryable: true,
          code: failure.code,
        };
      case 'unknown_challenge':
        return {
          message: 'This challenge is no longer available.',
          retryable: false,
          code: failure.code,
        };
      // ── S3b: governed activity-application rejections ──────────────
      // Each is the server's durable decision about THIS entry. Retrying
      // the identical entry reproduces the decision; the member must
      // change the entry (or accept it). None is retryable.
      case 'no_current_group_membership':
        return {
          message: 'Only current members of the hosting group can log activity right now.',
          retryable: false,
          code: failure.code,
        };
      case 'challenge_not_active':
        return {
          message: 'This Challenge is not open for logging right now.',
          retryable: false,
          code: failure.code,
        };
      case 'no_participation_episode':
        return {
          message: 'This entry falls outside your current participation period, so it cannot be recorded.',
          retryable: false,
          code: failure.code,
        };
      case 'outside_challenge_window':
        return {
          message: 'This entry falls outside the Challenge window, so it cannot be counted.',
          retryable: false,
          code: failure.code,
        };
      case 'wrong_activity':
      case 'wrong_variant':
      case 'unknown_activity':
        return {
          message: 'This activity is not part of what counts for this Challenge.',
          retryable: false,
          code: failure.code,
        };
      case 'wrong_unit':
        return {
          message: 'This measurement does not match what this Challenge counts. Check the unit and try again.',
          retryable: false,
          code: failure.code,
        };
      case 'knowledge_mismatch':
        return {
          message: 'This activity does not match the Challenge configured activity.',
          retryable: false,
          code: failure.code,
        };
      case 'streak_day_closed':
        return {
          message: 'That day is already closed for this Challenge — entries cannot be added late.',
          retryable: false,
          code: failure.code,
        };
      case 'occurred_day_mismatch':
        return {
          message: 'The day for this entry does not line up with the Challenge timezone. It was not recorded.',
          retryable: false,
          code: failure.code,
        };
      case 'invalid_occurred_at':
      case 'future_occurred_at':
      case 'invalid_value':
      case 'invalid_unit':
        return {
          message: 'Please check the amount and the date/time for this entry.',
          retryable: false,
          code: failure.code,
        };
      case 'server_derived_field':
        return {
          message: 'This entry included a value only the server may set. It was not recorded.',
          retryable: false,
          code: failure.code,
        };
      case 'idempotency_key_conflict':
        return {
          message: 'This entry uses a key that was already used. Start a new entry — if your earlier entry was recorded, it is unchanged.',
          retryable: false,
          code: failure.code,
        };
      case 'challenge_closed_during_acceptance':
        return {
          message: 'This Challenge closed while recording. The entry was not counted.',
          retryable: false,
          code: failure.code,
        };
      case 'evidence_rejected':
        return {
          message: 'This entry could not be recorded. Check the details and try again.',
          retryable: false,
          code: failure.code,
        };
      default:
        break;
    }
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
