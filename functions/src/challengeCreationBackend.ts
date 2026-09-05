import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

type CoreDb = {
  collection: (path: string) => any;
  runTransaction: <T>(callback: (transaction: any) => Promise<T>) => Promise<T>;
};

type ChallengeCategory =
  | 'fitness'
  | 'fasting'
  | 'hydration'
  | 'sleep'
  | 'mindfulness'
  | 'nutrition'
  | 'habits'
  | 'stress'
  | 'social'
  | 'wellness';

type ChallengeType = 'collective' | 'competitive' | 'streak';

type ChallengeActivityInput = {
  exerciseId?: unknown;
  activityId?: unknown;
  activityType?: unknown;
  exerciseName?: unknown;
  description?: unknown;
  category?: unknown;
  difficulty?: unknown;
  icon?: unknown;
  targetValue?: unknown;
  unit?: unknown;
  instructions?: unknown;
  protocolSteps?: unknown;
  benefits?: unknown;
  guidelines?: unknown;
  warnings?: unknown;
  frequency?: unknown;
  pointsPerCompletion?: unknown;
  dailyFrequency?: unknown;
  targetType?: unknown;
  knowledgeVersion?: unknown;
  metric?: unknown;
  tier1?: unknown;
  tier2?: unknown;
};

export type CreateChallengeWithCreatorMembershipInput = {
  actorUid: string;
  category?: unknown;
  name?: unknown;
  description?: unknown;
  createdBy?: unknown;
  groupId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  durationDays?: unknown;
  challengeType?: unknown;
  coverImageUrl?: unknown;
  exerciseIds?: unknown;
  activities?: unknown;
  donation?: unknown;
  // v2 engine fields
  engineVersion?: unknown;
  groupCumulativeTarget?: unknown;
  autoCompleteOnGroupTarget?: unknown;
  requiredConsecutiveDays?: unknown;
  streakResetOnMiss?: unknown;
};

type GroupRecord = {
  ownerId?: string;
  status?: string;
  isPrivate?: boolean;
  visibility?: string;
  allowMemberChallenges?: boolean;
};

type MembershipRecord = {
  status?: string;
  role?: string;
};

const ACTIVE_GROUP_MEMBER_STATUSES = new Set(['active', 'joined']);
const VALID_CATEGORIES = new Set<ChallengeCategory>([
  'fitness',
  'fasting',
  'hydration',
  'sleep',
  'mindfulness',
  'nutrition',
  'habits',
  'stress',
  'social',
  'wellness',
]);
const VALID_CHALLENGE_TYPES = new Set<ChallengeType>(['collective', 'competitive', 'streak']);
const VALID_FREQUENCIES = new Set(['daily', 'weekly', '2x-week', '3x-week', '5x-week', 'custom']);

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown, maxLength = 1000): string | undefined {
  const valueAsString = stringValue(value);
  return valueAsString ? valueAsString.slice(0, maxLength) : undefined;
}

function requireString(value: unknown, field: string, options: { min?: number; max?: number } = {}) {
  const valueAsString = stringValue(value);
  const min = options.min ?? 1;
  const max = options.max ?? 1000;
  if (valueAsString.length < min || valueAsString.length > max) {
    throw new HttpsError('invalid-argument', `${field} must be between ${min} and ${max} characters`);
  }
  return valueAsString;
}

function optionalNumber(value: unknown, field: string, options: { min?: number; max?: number } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HttpsError('invalid-argument', `${field} is outside the allowed range`);
  }
  return parsed;
}

function requirePositiveNumber(value: unknown, field: string) {
  const parsed = optionalNumber(value, field, { min: 0.000001, max: 100000000 });
  if (parsed === undefined) {
    throw new HttpsError('invalid-argument', `${field} is required`);
  }
  return parsed;
}

function normalizeIsoDate(value: unknown, field: string, fallback?: Date) {
  if (value === undefined || value === null || value === '') {
    if (fallback) return fallback.toISOString();
    throw new HttpsError('invalid-argument', `${field} is required`);
  }
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) {
    throw new HttpsError('invalid-argument', `${field} must be a valid date`);
  }
  return parsed.toISOString();
}

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedDeep(item)]),
    ) as T;
  }

  return value;
}

function stringArray(value: unknown, maxItems = 50, maxLength = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => stringValue(item).slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeCategory(value: unknown): ChallengeCategory {
  const category = stringValue(value) as ChallengeCategory;
  return VALID_CATEGORIES.has(category) ? category : 'fitness';
}

function normalizeChallengeType(value: unknown): ChallengeType {
  if (value === undefined || value === null || value === '') return 'collective';
  const s = stringValue(value) as ChallengeType;
  if (!VALID_CHALLENGE_TYPES.has(s)) {
    throw new HttpsError('invalid-argument', `challengeType must be one of: ${[...VALID_CHALLENGE_TYPES].join(', ')}`);
  }
  return s;
}

function requireEngineVersion(value: unknown): 'v2' | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'v2') return 'v2';
  throw new HttpsError('invalid-argument', "engineVersion must be 'v2' or omitted");
}

function normalizeActivities(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((raw, index) => {
    const activity = (raw ?? {}) as ChallengeActivityInput;
    const targetValue = requirePositiveNumber(activity.targetValue, `activities.${index}.targetValue`);
    const unit = requireString(activity.unit, `activities.${index}.unit`, { min: 1, max: 40 });
    const frequency = stringValue(activity.frequency);

    return removeUndefinedDeep({
      exerciseId: optionalString(activity.exerciseId, 120),
      activityId: optionalString(activity.activityId, 120),
      activityType: optionalString(activity.activityType, 80),
      exerciseName: optionalString(activity.exerciseName, 160),
      description: optionalString(activity.description, 1000),
      category: optionalString(activity.category, 80),
      difficulty: optionalString(activity.difficulty, 80),
      icon: optionalString(activity.icon, 40),
      targetValue,
      unit,
      instructions: stringArray(activity.instructions),
      protocolSteps: stringArray(activity.protocolSteps),
      benefits: stringArray(activity.benefits),
      guidelines: stringArray(activity.guidelines),
      warnings: stringArray(activity.warnings),
      frequency: VALID_FREQUENCIES.has(frequency) ? frequency : undefined,
      pointsPerCompletion: optionalNumber(activity.pointsPerCompletion, `activities.${index}.pointsPerCompletion`, {
        min: 0,
        max: 100000,
      }),
      dailyFrequency: optionalNumber(activity.dailyFrequency, `activities.${index}.dailyFrequency`, { min: 0, max: 1000 }),
      targetType: normalizeTargetType(activity.targetType),
      // P1-4: canonical Knowledge version the activity was snapshotted from
      // (omitted for legacy snapshots that predate version tracking).
      knowledgeVersion: optionalNumber(activity.knowledgeVersion, `activities.${index}.knowledgeVersion`, { min: 1, max: 1000000 }),
      // P2-2: immutable canonical snapshot (fitness classification/metric).
      metric: optionalString(activity.metric, 100),
      tier1: optionalString(activity.tier1, 200),
      tier2: optionalString(activity.tier2, 200),
    });
  });
}

function normalizeTargetType(value: unknown): 'daily' | 'cumulative' | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'daily' || value === 'cumulative') return value;
  throw new HttpsError('invalid-argument', `targetType must be 'daily', 'cumulative', or omitted — got: ${String(value)}`);
}

function normalizeDonation(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const donation = value as Record<string, unknown>;
  const enabled = donation.enabled === true;

  return removeUndefinedDeep({
    enabled,
    causeName: optionalString(donation.causeName, 160),
    causeDescription: optionalString(donation.causeDescription, 1200),
    targetAmountKes: optionalNumber(donation.targetAmountKes, 'donation.targetAmountKes', { min: 0, max: 100000000 }),
    contributionStartDate: optionalString(donation.contributionStartDate, 80),
    contributionEndDate: optionalString(donation.contributionEndDate, 80),
    contributionPhoneNumber: optionalString(donation.contributionPhoneNumber, 80),
    contributionCardUrl: optionalString(donation.contributionCardUrl, 500),
    disclaimer:
      optionalString(donation.disclaimer, 1000)
      ?? (enabled ? 'Tiizi does not hold or manage funds. Contributions are coordinated by the group.' : undefined),
    approvalRequired: enabled,
    approvalStatus: enabled ? 'pending' : 'approved',
    acceptingDonations: !enabled,
  });
}

function isActiveGroupMember(data: MembershipRecord | null) {
  return ACTIVE_GROUP_MEMBER_STATUSES.has(String(data?.status ?? '').toLowerCase());
}

function normalizeGroupVisibility(group: GroupRecord): 'public' | 'private' {
  return group.visibility === 'private' || group.isPrivate === true ? 'private' : 'public';
}

interface CanonicalSnapshot {
  knowledgeVersion: number;
  metric?: string;
  tier1?: string;
  tier2?: string;
}

function normalizeCanonicalVersion(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * CORR-1/CORR-2 authoritative canonical resolution. A supplied
 * exerciseId/activityId is a canonical identity claim and MUST resolve:
 * missing documents plus draft/retired records throw invalid-argument.
 * Custom entries (no canonical ID) resolve to nothing and pass through.
 * Returns pinned immutable snapshot fields keyed by `collection/id`.
 */
async function resolveCanonicalSnapshots(
  db: CoreDb,
  activities: Array<{ exerciseId?: string; activityId?: string }>,
): Promise<Map<string, CanonicalSnapshot>> {
  const snapshots = new Map<string, CanonicalSnapshot>();
  for (const activity of activities) {
    const exerciseId = String(activity.exerciseId ?? '').trim();
    if (exerciseId) {
      const snap = await db.collection('catalogExercises').doc(exerciseId).get();
      const data = snap && snap.exists
        ? (snap.data() as Record<string, unknown> | undefined)
        : undefined;
      if (!data) {
        throw new HttpsError(
          'invalid-argument',
          `Unknown canonical exercise "${exerciseId}". Custom activities must not carry an exerciseId.`,
        );
      }
      const status = data.lifecycleStatus;
      if (typeof status === 'string' && status !== 'published') {
        throw new HttpsError(
          'invalid-argument',
          `Activity "${exerciseId}" is no longer available for new challenges (retired or draft). Please replace it.`,
        );
      }
      const metric = data.metric as { type?: unknown } | undefined;
      snapshots.set(`catalogExercises/${exerciseId}`, {
        knowledgeVersion: normalizeCanonicalVersion(data.knowledgeVersion),
        metric: optionalString(metric?.type, 100),
        tier1: optionalString(data.tier_1, 200),
        tier2: optionalString(data.tier_2, 200),
      });
      continue;
    }
    const activityId = String(activity.activityId ?? '').trim();
    if (activityId) {
      const snap = await db.collection('wellnessActivities').doc(activityId).get();
      const data = snap && snap.exists
        ? (snap.data() as Record<string, unknown> | undefined)
        : undefined;
      if (!data) {
        throw new HttpsError(
          'invalid-argument',
          `Unknown canonical wellness activity "${activityId}". Custom activities must not carry an activityId.`,
        );
      }
      const status = data.lifecycleStatus;
      if (typeof status === 'string' && status !== 'published') {
        throw new HttpsError(
          'invalid-argument',
          `Activity "${activityId}" is no longer available for new challenges (retired or draft). Please replace it.`,
        );
      }
      snapshots.set(`wellnessActivities/${activityId}`, {
        knowledgeVersion: normalizeCanonicalVersion(data.knowledgeVersion),
      });
    }
  }
  return snapshots;
}

/**
 * Overwrites client-supplied canonical snapshot fields with authoritative
 * values. Fields absent from the record keep their submitted values
 * (challenge-level customization); knowledgeVersion is always authoritative.
 */
function applyCanonicalSnapshots(
  activities: Array<{ exerciseId?: string; activityId?: string; knowledgeVersion?: number; metric?: string; tier1?: string; tier2?: string }>,
  snapshots: Map<string, CanonicalSnapshot>,
): void {
  for (const activity of activities) {
    const key = activity.exerciseId
      ? `catalogExercises/${activity.exerciseId}`
      : activity.activityId
        ? `wellnessActivities/${activity.activityId}`
        : null;
    const pin = key ? snapshots.get(key) : undefined;
    if (pin) {
      activity.knowledgeVersion = pin.knowledgeVersion;
      if (pin.metric !== undefined) activity.metric = pin.metric;
      if (pin.tier1 !== undefined) activity.tier1 = pin.tier1;
      if (pin.tier2 !== undefined) activity.tier2 = pin.tier2;
    }
  }
}

async function getDocData<T extends Record<string, unknown>>(transaction: any, ref: any): Promise<T | null> {
  const snap = await transaction.get(ref);
  return snap.exists ? (snap.data() as T) : null;
}

export async function createChallengeWithCreatorMembershipCore(
  db: CoreDb,
  input: CreateChallengeWithCreatorMembershipInput,
) {
  const actorUid = requireString(input.actorUid, 'actorUid', { min: 1, max: 200 });
  const createdBy = optionalString(input.createdBy, 200) ?? actorUid;
  if (createdBy !== actorUid) {
    throw new HttpsError('permission-denied', 'You can only create challenges as yourself');
  }

  const groupId = requireString(input.groupId, 'groupId', { min: 1, max: 200 });
  const name = requireString(input.name, 'name', { min: 3, max: 120 });
  const description = requireString(input.description, 'description', { min: 1, max: 2000 });
  const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
  const nowIso = new Date().toISOString();
  const startDate = normalizeIsoDate(input.startDate, 'startDate', new Date());

  // durationDays / endDate resolution — matches challengeService.createChallenge() exactly:
  //   • If endDate is provided, derive durationDays from the date difference (never default to 14).
  //   • If only durationDays is provided, compute endDate from it.
  //   • If neither is provided, fall back to durationDays = 14 (same as client default).
  let durationDays: number;
  let endDate: string;
  if (input.endDate) {
    endDate = normalizeIsoDate(input.endDate, 'endDate');
    const explicitDuration = optionalNumber(input.durationDays, 'durationDays', { min: 1, max: 366 });
    // Prefer the explicit value when both are supplied; otherwise derive from the dates.
    durationDays = explicitDuration
      ?? Math.max(1, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1);
  } else {
    durationDays = optionalNumber(input.durationDays, 'durationDays', { min: 1, max: 366 }) ?? 14;
    const date = new Date(startDate);
    date.setDate(date.getDate() + durationDays);
    endDate = date.toISOString();
  }

  if (Date.parse(endDate) <= Date.parse(startDate)) {
    throw new HttpsError('invalid-argument', 'endDate must be after startDate');
  }

  const challengeType = normalizeChallengeType(input.challengeType);

  // Engine fields — validated and typed here so the payload block stays clean.
  const engineVersion = requireEngineVersion(input.engineVersion);
  const groupCumulativeTarget = challengeType === 'collective'
    ? optionalNumber(input.groupCumulativeTarget, 'groupCumulativeTarget', { min: 0, max: 1_000_000_000 })
    : undefined;
  const autoCompleteOnGroupTarget = challengeType === 'collective' && input.autoCompleteOnGroupTarget === true
    ? true
    : undefined;
  const requiredConsecutiveDays = challengeType === 'streak'
    ? optionalNumber(input.requiredConsecutiveDays, 'requiredConsecutiveDays', { min: 1, max: 366 })
    : undefined;
  const streakResetOnMiss = challengeType === 'streak' && input.streakResetOnMiss === true
    ? true
    : undefined;

  // --- Pre-transaction business validation (no Firestore reads needed) ---

  // Activities must be normalized before validation so normalizeActivities()
  // can throw on invalid targetValues/units before we open a transaction.
  const activities = normalizeActivities(input.activities);

  if (activities.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one activity is required');
  }

  // Duplicate activity detection — two activities sharing the same exerciseId or
  // activityId would produce ambiguous per-activity scoring.
  const seenIds = new Set<string>();
  for (const activity of activities) {
    const id = String(activity.exerciseId ?? activity.activityId ?? '').trim();
    if (id) {
      if (seenIds.has(id)) {
        throw new HttpsError('invalid-argument', `Duplicate activity id: ${id}`);
      }
      seenIds.add(id);
    }
  }

  // Canonical Knowledge gate (P2-1/CORR-1, authoritative): every supplied
  // canonical ID must resolve to a currently-published record. Unknown IDs
  // are rejected (custom entries must carry no canonical ID). Reads happen
  // here, before the transaction opens. Historical challenges are never
  // re-validated, so retirement cannot break them.
  const canonicalSnapshots = await resolveCanonicalSnapshots(db, activities);

  // CORR-2: pin immutable canonical snapshot fields from the authoritative
  // record — a client cannot falsely claim a different canonical version or
  // classification. Challenge-specific configuration (targetValue, unit,
  // frequency, descriptions) stays client-supplied; entries without a
  // resolvable record keep their submitted snapshot as-is.
  applyCanonicalSnapshots(activities, canonicalSnapshots);

  // Collective: group cumulative target, when provided, must be positive.
  if (challengeType === 'collective' && groupCumulativeTarget !== undefined && groupCumulativeTarget <= 0) {
    throw new HttpsError('invalid-argument', 'groupCumulativeTarget must be greater than 0');
  }

  // Collective: mixed-unit check — the score pool sums all logged values so
  // mixed units (e.g. minutes + km) produce a meaningless total.
  if (challengeType === 'collective' && activities.length > 1) {
    const units = new Set(activities.map((a) => String(a.unit ?? '').toLowerCase().trim()));
    if (units.size > 1) {
      throw new HttpsError(
        'invalid-argument',
        `Collective challenges must use a single measurement unit. Found mixed units: ${[...units].join(', ')}`,
      );
    }
  }

  // Streak: requiredConsecutiveDays must not exceed the challenge duration.
  if (challengeType === 'streak' && requiredConsecutiveDays !== undefined && requiredConsecutiveDays > durationDays) {
    throw new HttpsError(
      'invalid-argument',
      `requiredConsecutiveDays (${requiredConsecutiveDays}) cannot exceed durationDays (${durationDays})`,
    );
  }

  // Donation: if enabled, a payment contact method is required.
  const donation = normalizeDonation(input.donation);
  if (donation?.enabled === true && !donation.contributionPhoneNumber && !donation.contributionCardUrl) {
    throw new HttpsError(
      'invalid-argument',
      'Donation-enabled challenges require either contributionPhoneNumber or contributionCardUrl',
    );
  }

  const requiresDonationApproval = donation?.enabled === true;
  const challengeRef = db.collection('challenges').doc();
  const challengeId = challengeRef.id;
  const groupRef = db.collection('groups').doc(groupId);
  const groupMemberRef = db.collection('groupMembers').doc(`${groupId}_${actorUid}`);
  const challengeMemberRef = db.collection('challengeMembers').doc(`${challengeId}_${actorUid}`);

  return db.runTransaction(async (transaction) => {
    const group = await getDocData<GroupRecord>(transaction, groupRef);
    if (!group) {
      throw new HttpsError('not-found', 'Group not found');
    }
    if (String(group.status ?? '').toLowerCase() !== 'active') {
      throw new HttpsError('failed-precondition', 'Group is not active');
    }

    const existingMembership = await getDocData<MembershipRecord>(transaction, groupMemberRef);
    const isOwner = group.ownerId === actorUid;
    const isAdmin = existingMembership?.role === 'admin';
    const creatorIsActiveMember = isActiveGroupMember(existingMembership);
    if (!creatorIsActiveMember && !isOwner) {
      throw new HttpsError('permission-denied', 'Join this group before creating a challenge');
    }

    if (!existingMembership && isOwner) {
      transaction.set(groupMemberRef, {
        groupId,
        userId: actorUid,
        role: 'owner',
        status: 'active',
        createdAt: nowIso,
        approvedAt: nowIso,
      });
    }

    const groupVisibility = normalizeGroupVisibility(group);
    const isOwnerOrAdmin = isOwner || isAdmin;
    const requiresModerationApproval = groupVisibility === 'private' && !isOwnerOrAdmin;
    const challengePayload = removeUndefinedDeep({
      category: normalizeCategory(input.category),
      name,
      description,
      groupId,
      exerciseIds: stringArray(input.exerciseIds, 50, 120),
      challengeType,
      coverImageUrl: optionalString(input.coverImageUrl, 500),
      activities,
      durationDays,
      donation,
      startDate,
      endDate,
      createdBy: actorUid,
      status: requiresDonationApproval ? 'draft' : requiresModerationApproval ? 'pending' : 'active',
      createdAt: nowIso,
      groupVisibility,
      visibility: groupVisibility,
      moderationStatus: requiresDonationApproval ? 'pending' : requiresModerationApproval ? 'pending' : 'approved',
      participantCount: 0,
      // v2 engine fields — only written when present; undefined is stripped by removeUndefinedDeep
      engineVersion,
      groupCumulativeTarget,
      autoCompleteOnGroupTarget,
      requiredConsecutiveDays,
      streakResetOnMiss,
    });

    transaction.set(challengeRef, challengePayload);

    // Donation challenges go to 'draft' pending approval — the creator does not
    // become a member until the challenge is approved, matching client behaviour.
    if (!requiresDonationApproval) {
      const challengeMemberPayload = removeUndefinedDeep({
        challengeId,
        userId: actorUid,
        groupId,
        joinedAt: nowIso,
        status: 'active',
        activitiesCompleted: 0,
        totalActivities: Math.max(1, challengePayload.activities.length) * durationDays,
        totalPoints: 0,
        completionRate: 0,
        // Streak challenges: always reset streak counters so a stale streak from a prior
        // membership cannot carry over. lastLogDate is absent from this payload so the
        // full-overwrite set() removes any stale value from a previous membership doc.
        ...(challengeType === 'streak' ? { currentStreak: 0, longestStreak: 0 } : {}),
      });

      const userRef = db.collection('users').doc(actorUid);

      transaction.set(challengeMemberRef, challengeMemberPayload);
      transaction.set(
        userRef,
        { stats: { totalChallenges: FieldValue.increment(1) }, lastChallengeJoinedAt: nowIso },
        { merge: true },
      );

      return {
        challenge: { id: challengeId, ...challengePayload },
        challengeMember: challengeMemberPayload,
        challengeMemberId: `${challengeId}_${actorUid}`,
        creatorMembershipCreated: !existingMembership && isOwner,
      };
    }

    return {
      challenge: { id: challengeId, ...challengePayload },
      challengeMember: null,
      challengeMemberId: null,
      creatorMembershipCreated: !existingMembership && isOwner,
    };
  });
}

function uidFromRequest(request: CallableRequest<unknown>) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in to create a challenge');
  }
  return uid;
}

const ADMIN_CREATOR_ROLES = new Set(['super_admin', 'admin', 'moderator']);

/**
 * CORR-2: trusted server path for admin-created challenges. Mirrors
 * adminChallengeService.createChallengeFromAdmin semantics (no group
 * membership requirement, no creator auto-join, approval flow for
 * donation challenges) with server-side validation: caller must hold an
 * admin role, activities pass the canonical gate, and canonical snapshot
 * fields are pinned from authoritative records.
 */
export async function createChallengeFromAdminCore(
  db: CoreDb,
  input: {
    actorUid?: unknown;
    category?: unknown;
    name?: unknown;
    description?: unknown;
    challengeType?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    createdBy?: unknown;
    coverImageUrl?: unknown;
    activities?: unknown;
    donation?: unknown;
  },
) {
  const actorUid = requireString(input.actorUid, 'actorUid', { min: 1, max: 200 });
  const adminSnap = await db.collection('admins').doc(actorUid).get();
  const adminRole = String(
    (adminSnap && adminSnap.exists ? adminSnap.data() as Record<string, unknown> | undefined : undefined)?.role ?? '',
  ).toLowerCase();
  if (!ADMIN_CREATOR_ROLES.has(adminRole)) {
    throw new HttpsError('permission-denied', 'Admin role required to create challenges from admin');
  }

  const createdBy = requireString(input.createdBy, 'createdBy', { min: 1, max: 200 });
  const name = requireString(input.name, 'name', { min: 3, max: 120 });
  const description = requireString(input.description, 'description', { min: 1, max: 2000 });
  const nowIso = new Date().toISOString();
  const startDate = normalizeIsoDate(input.startDate, 'startDate', new Date());
  const endDate = normalizeIsoDate(input.endDate, 'endDate');
  if (Date.parse(endDate) <= Date.parse(startDate)) {
    throw new HttpsError('invalid-argument', 'endDate must be after startDate');
  }
  const challengeType = normalizeChallengeType(input.challengeType);

  const activities = normalizeActivities(input.activities);
  if (activities.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one activity is required');
  }
  const seenIds = new Set<string>();
  for (const activity of activities) {
    const id = String(activity.exerciseId ?? activity.activityId ?? '').trim();
    if (id) {
      if (seenIds.has(id)) {
        throw new HttpsError('invalid-argument', `Duplicate activity id: ${id}`);
      }
      seenIds.add(id);
    }
  }
  const canonicalSnapshots = await resolveCanonicalSnapshots(db, activities);
  applyCanonicalSnapshots(activities, canonicalSnapshots);

  const donation = normalizeDonation(input.donation);
  const requiresApproval = donation?.enabled === true;
  const challengeRef = db.collection('challenges').doc();
  const challengeId = challengeRef.id;

  const payload = removeUndefinedDeep({
    category: normalizeCategory(input.category),
    name,
    description,
    challengeType,
    coverImageUrl: optionalString(input.coverImageUrl, 500),
    activities,
    durationDays: Math.max(1, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1),
    donation: donation?.enabled
      ? { ...donation, approvalStatus: 'pending' }
      : donation,
    startDate,
    endDate,
    createdBy,
    status: requiresApproval ? 'draft' : 'active',
    progress: 0,
    participantCount: 0,
    moderationStatus: requiresApproval ? 'pending' : 'approved',
    createdAt: nowIso,
  });

  await db.runTransaction(async (transaction) => {
    transaction.set(challengeRef, payload);
  });
  return { challenge: { id: challengeId } };
}

export function createChallengeWithCreatorMembershipCallable(db: Firestore) {
  return onCall(
    {
      region: 'us-central1',
    },
    async (request) => {
      return createChallengeWithCreatorMembershipCore(db, {
        ...((request.data ?? {}) as Record<string, unknown>),
        actorUid: uidFromRequest(request),
      });
    },
  );
}

export function createChallengeFromAdminCallable(db: Firestore) {
  return onCall(
    {
      region: 'us-central1',
    },
    async (request) => {
      return createChallengeFromAdminCore(db, {
        ...((request.data ?? {}) as Record<string, unknown>),
        actorUid: uidFromRequest(request),
      });
    },
  );
}
