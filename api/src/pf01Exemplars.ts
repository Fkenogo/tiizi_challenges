/**
 * PF-01 canonical V2 exemplar Activities (Founder PF-01 TASK 7).
 *
 * Two real governed V2 records — not placeholder preview data:
 * - FIT-STR-001 Push-Up (fitness technique exemplar, U+Q+T+S);
 * - WEL-MND-003 Breathing Practice (wellness protocol exemplar, U+Q+P+C+S).
 *
 * Authority: the approved Stage F/KCS minima and the Founder working
 * baselines (118-Activity baseline §§9–22 for identity/taxonomy/compatible
 * Metrics/Units; Metric/Unit baseline §§2–8 for the governed vocabularies).
 * Safety content is general practice caution only — no clinical claims.
 *
 * These definitions are the TypeScript source consumed by the PF-01 tests
 * (driven through the real creation → compatibility → publication gate).
 * Migration 014_pf01_exemplar_activities.sql carries the same content for
 * deployed environments; any change must update both.
 */

import type { CreateKnowledgeInput } from './knowledge.js';

export const PUSH_UP_ACTIVITY_CODE = 'FIT-STR-001';
export const BREATHING_PRACTICE_ACTIVITY_CODE = 'WEL-MND-003';

export interface Pf01ExemplarContract {
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
}

export function pushUpExemplarInput(): CreateKnowledgeInput & { activityCode: string } {
  return {
    kind: 'fitness',
    activityCode: PUSH_UP_ACTIVITY_CODE,
    name: 'Push-Up',
    category: 'Strength',
    subcategory: 'Push',
    difficulty: 'Intermediate',
    description:
      'A foundational bodyweight pushing movement performed from a plank position, lowering the chest toward the floor and pressing back up.',
    metricUnit: 'reps',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance:
      'Count one repetition for each full controlled lowering and press back to the starting plank. Report total repetitions per session.',
    unitSemantics:
      'One rep equals one complete down-and-up cycle counted when the chest lowers with control and the arms fully extend without resting on the floor.',
    setup:
      'Start in a high plank with hands under shoulders, body in a straight line from head to heels, core braced.',
    execution:
      'Lower the chest toward the floor by bending the elbows close to the body, then press through the palms to full arm extension while keeping the body straight.',
    formCues: [
      'Keep your body in a straight line',
      'Brace your core throughout',
      'Lower with control; do not drop',
    ],
    commonMistakes: [
      'Hips sagging or piking',
      'Flaring the elbows wide',
      'Partial range of motion',
    ],
    equipment: 'None required',
    environment: 'Flat stable floor surface with enough space to lie prone',
    adaptation:
      'Beginners may perform incline push-ups against a raised surface or from the knees while keeping the trunk straight.',
    safetyNotes: [
      'Stop if you feel sharp pain in shoulders, wrists or lower back',
      'Keep wrists stacked under shoulders to avoid strain',
    ],
  };
}

export const PUSH_UP_CONTRACT: Pf01ExemplarContract = {
  primaryMetrics: ['repetitions'],
  secondaryMetrics: [],
  compatibleUnits: ['reps'],
};

export function breathingPracticeExemplarInput(): CreateKnowledgeInput & { activityCode: string } {
  return {
    kind: 'wellness',
    activityCode: BREATHING_PRACTICE_ACTIVITY_CODE,
    name: 'Breathing Practice',
    category: 'Mind & Emotional Wellbeing',
    subcategory: 'Mind-Body Practice',
    difficulty: 'beginner',
    description:
      'A guided slow-breathing session practiced seated or lying down, following a simple inhale-hold-exhale rhythm.',
    metricUnit: 'minutes',
    contentClasses: ['U', 'Q', 'P', 'C', 'S'],
    measurementGuidance:
      'Report session length in whole minutes, or mark the session complete when the guided protocol is finished, whichever the challenge tracks.',
    unitSemantics:
      'One minute equals sixty seconds of guided practice; completion means the full protocol below was followed to its end.',
    protocolSteps: [
      'Sit or lie down in a comfortable position with the back supported.',
      'Breathe in slowly through the nose for a count of four.',
      'Hold gently for a count of four.',
      'Breathe out slowly through the mouth for a count of six.',
      'Repeat the cycle for the chosen session length, then breathe normally.',
    ],
    sessionFraming: 'A quiet seated or lying session of slow guided breathing, practiced at rest.',
    completionMeaning:
      'A session counts as complete when every protocol step above has been followed through to the final normal breath.',
    safetyNotes: [
      'Practice seated or lying down in a safe place',
      'Stop and breathe normally if you feel dizzy or uncomfortable',
    ],
  };
}

export const BREATHING_PRACTICE_CONTRACT: Pf01ExemplarContract = {
  primaryMetrics: ['completion', 'duration'],
  secondaryMetrics: [],
  compatibleUnits: ['completion', 'minutes', 'seconds'],
};
