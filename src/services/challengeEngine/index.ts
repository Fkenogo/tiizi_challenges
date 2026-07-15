/**
 * Challenge Engine — Entry Point
 *
 * selectEngine() routes to the correct engine based on challenge.challengeType.
 * Only engineVersion === 'v2' challenges are supported — the legacy v1 engine
 * was removed in Phase 5 (pre-beta legacy cleanup). Callers must check
 * challenge.engineVersion === 'v2' before invoking selectEngine(); it throws
 * for anything else rather than silently falling back to legacy behavior.
 *
 * Usage:
 *   const engine = selectEngine(challengeDoc);
 *   const result = engine.computeUpdate(context, membership, logEvent, challengeSnap);
 *   // apply result.membershipUpdate and result.challengeUpdate via batch
 *
 * See: docs/architecture/challenge-engine-spec.md
 */

import type { ChallengeEngine } from './types';
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
 *   challengeType === 'streak'      → StreakEngine
 *   challengeType === 'competitive' → CompetitiveEngine
 *   challengeType === 'collective'  → CollectiveEngine
 *   engineVersion !== 'v2', or unknown challengeType → throws loud error (no silent fallback)
 */
export function selectEngine(challenge: EngineSelector): ChallengeEngine {
  if (challenge.engineVersion !== 'v2') {
    throw new Error(
      'selectEngine: this challenge is not on the v2 engine and is no longer supported. ' +
      'Legacy (v1) challenges cannot be logged against.',
    );
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
        'Use a supported type (streak, competitive, collective).',
      );
  }
}

export type { ChallengeEngine, ChallengeContext, MembershipSnapshot, LogEvent, EngineResult, EngineVersion, ChallengeType, TargetType } from './types';
export { StreakEngine } from './streakEngine';
export { CompetitiveEngine } from './competitiveEngine';
export { CollectiveEngine } from './collectiveEngine';
