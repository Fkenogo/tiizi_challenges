/**
 * Challenge Engine — Entry Point
 *
 * selectEngine() routes to the correct engine based on challenge.engineVersion
 * and challenge.challengeType. All v1 challenges (engineVersion undefined or
 * not 'v2') use LegacyEngine.
 *
 * Phase 11C: wired into workoutService + wellnessLogService (LegacyEngine for all v1).
 * Phase 11D: StreakEngine active for v2 + streak challenges.
 * Phase 11E: CompetitiveEngine active for v2 + competitive challenges.
 * Phase 11F: CollectiveEngine active for v2 + collective challenges.
 *
 * Usage:
 *   const engine = selectEngine(challengeDoc);
 *   const result = engine.computeUpdate(context, membership, logEvent, challengeSnap);
 *   // apply result.membershipUpdate and result.challengeUpdate via batch
 *
 * See: docs/architecture/challenge-engine-spec.md
 */

import type { ChallengeEngine } from './types';
import { LegacyEngine } from './legacyEngine';
import { StreakEngine } from './streakEngine';
import { CompetitiveEngine } from './competitiveEngine';
import { CollectiveEngine } from './collectiveEngine';

/** Minimal shape required for engine selection — avoids importing the full Challenge type. */
interface EngineSelector {
  engineVersion?: string;
  challengeType?: string;
}

/**
 * Select the appropriate engine for a challenge.
 *
 * Decision table:
 *   engineVersion !== 'v2'          → LegacyEngine  (all existing challenges)
 *   v2 + challengeType === 'streak'      → StreakEngine       (Phase 11D — active)
 *   v2 + challengeType === 'competitive' → CompetitiveEngine  (Phase 11E — active)
 *   v2 + challengeType === 'collective'  → CollectiveEngine   (Phase 11F — active)
 *   v2 + unknown type                    → throws loud error (no silent fallback)
 */
export function selectEngine(challenge: EngineSelector): ChallengeEngine {
  if (challenge.engineVersion !== 'v2') {
    return new LegacyEngine();
  }

  switch (challenge.challengeType) {
    case 'streak':
      return new StreakEngine();
    case 'competitive':
      return new CompetitiveEngine();
    case 'collective':
      return new CollectiveEngine();
    default:
      throw new Error(
        `selectEngine: unknown v2 challengeType "${challenge.challengeType}". ` +
        'Set engineVersion to v1 or use a supported type (streak, competitive, collective).',
      );
  }
}

export type { ChallengeEngine, ChallengeContext, MembershipSnapshot, LogEvent, EngineResult, EngineVersion, ChallengeType, TargetType } from './types';
export { LegacyEngine } from './legacyEngine';
export { StreakEngine } from './streakEngine';
export { CompetitiveEngine } from './competitiveEngine';
export { CollectiveEngine } from './collectiveEngine';
