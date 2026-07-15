/**
 * Single canonical source of truth for Group metadata selection options
 * (groupType, locationScope, activityInterests, wellnessTopics, groupGoals).
 *
 * CreateGroupScreen and EditGroupScreen previously each defined their own
 * option arrays independently, and those arrays had genuinely diverged (see
 * docs/reports/group-detail-focus-enhancement.md for the original audit).
 * Both screens now import these arrays instead of defining their own, so
 * Create/Edit/Display can never drift again.
 *
 * groupGoals in particular used to be persisted two incompatible ways:
 * CreateGroupScreen wrote the literal label string (e.g. "Keep Fit
 * Together"), EditGroupScreen wrote an opaque id (e.g. "consistency"). This
 * module's GROUP_GOALS canonical labels were chosen to exactly match every
 * pre-existing CreateGroupScreen literal label, so legacy documents that
 * already have a literal label persisted display identically to new
 * id-based documents — no data migration is required, and old values remain
 * valid without rewriting.
 */

export const GROUP_TYPES = [
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'wellness', label: 'Wellness', icon: '🧘' },
  { id: 'mixed', label: 'Mixed', icon: '🌀' },
  { id: 'cause-based', label: 'Cause-based', icon: '❤️' },
  { id: 'workplace', label: 'Workplace', icon: '🏢' },
  { id: 'school', label: 'School', icon: '🎓' },
  { id: 'friends-family', label: 'Friends / Family', icon: '👨‍👩‍👧' },
  { id: 'community', label: 'Community', icon: '🏘️' },
] as const;

// Ids are unchanged from both screens' previous lists; wording uses the
// shorter Create-style labels so it fits compact hero pills as well as the
// Edit screen's chip buttons.
export const LOCATION_SCOPES = [
  { id: 'local', label: 'Local', icon: '📍' },
  { id: 'online', label: 'Online', icon: '🌐' },
  { id: 'workplace', label: 'Workplace', icon: '🏢' },
  { id: 'school', label: 'School', icon: '🎓' },
  { id: 'private-circle', label: 'Private Circle', icon: '🔒' },
] as const;

// Union of the two screens' previously-diverged activity id sets. Every id
// either screen ever persisted is present here.
export const ACTIVITY_OPTIONS = [
  { id: 'running', name: 'Running', icon: '🏃' },
  { id: 'walking', name: 'Walking', icon: '🚶' },
  { id: 'gym-weightlifting', name: 'Gym / Weightlifting', icon: '💪' },
  { id: 'home-workouts', name: 'Home Workouts', icon: '🏠' },
  { id: 'yoga', name: 'Yoga', icon: '🧘' },
  { id: 'swimming', name: 'Swimming', icon: '🏊' },
  { id: 'cycling', name: 'Cycling', icon: '🚴' },
  { id: 'football', name: 'Football (Soccer)', icon: '⚽' },
  { id: 'basketball', name: 'Basketball', icon: '🏀' },
  { id: 'hiking', name: 'Hiking', icon: '⛰️' },
  { id: 'group-fitness', name: 'Group Fitness', icon: '👥' },
  { id: 'hiit-circuit', name: 'HIIT / Circuit', icon: '⚡' },
  { id: 'pilates', name: 'Pilates', icon: '🤸' },
  { id: 'dancing', name: 'Dancing', icon: '💃' },
  { id: 'dance', name: 'Dance', icon: '💃' },
  { id: 'martial-arts', name: 'Martial Arts / Boxing', icon: '🥊' },
  { id: 'jump-rope', name: 'Jump Rope', icon: '🪢' },
  { id: 'stretching-mobility', name: 'Stretching / Mobility', icon: '🙆' },
  { id: 'crossfit', name: 'CrossFit / HIIT', icon: '🔥' },
  { id: 'tennis', name: 'Tennis / Racket', icon: '🎾' },
  { id: 'outdoors', name: 'Outdoor Adventures', icon: '🌲' },
  { id: 'sports-general', name: 'Team Sports', icon: '🏅' },
  { id: 'other', name: 'Other', icon: '✍️' },
] as const;

// Union of the two screens' previously-diverged wellness topic id sets.
export const WELLNESS_OPTIONS = [
  { id: 'mental-health', name: 'Mental Health', icon: '💙' },
  { id: 'sleep', name: 'Sleep & Recovery', icon: '😴' },
  { id: 'nutrition', name: 'Nutrition & Diet', icon: '🥗' },
  { id: 'hydration', name: 'Hydration', icon: '💧' },
  { id: 'meditation', name: 'Meditation', icon: '☮️' },
  { id: 'mindfulness', name: 'Mindfulness', icon: '🧠' },
  { id: 'stress-management', name: 'Stress Management', icon: '🌿' },
  { id: 'stress', name: 'Stress & Recovery', icon: '🌊' },
  { id: 'weight-management', name: 'Weight Management', icon: '⚖️' },
  { id: 'chronic-condition', name: 'Chronic Condition Support', icon: '🏥' },
  { id: 'energy', name: 'Energy & Vitality', icon: '⚡' },
  { id: 'posture', name: 'Posture & Mobility', icon: '🙆' },
  { id: 'social', name: 'Social Wellness', icon: '🤝' },
  { id: 'habits', name: 'Healthy Habits', icon: '✅' },
  { id: 'fasting', name: 'Fasting', icon: '⏱️' },
  { id: 'health-monitoring', name: 'Health Monitoring', icon: '📊' },
  { id: 'movement', name: 'Daily Movement', icon: '🚶' },
  { id: 'breathwork', name: 'Breathwork', icon: '🌬️' },
  { id: 'journaling', name: 'Journaling', icon: '📓' },
  { id: 'gratitude', name: 'Gratitude Practice', icon: '🙏' },
  { id: 'other', name: 'Other', icon: '✍️' },
] as const;

// Union of CreateGroupScreen's literal-label goals and EditGroupScreen's
// id-based goals, merged where they clearly describe the same goal. Every
// label below is copied verbatim from CreateGroupScreen's original literal
// strings so that pre-existing documents (which persisted the literal
// string, not an id) still resolve to the exact same displayed text.
export const GROUP_GOALS = [
  { id: 'keep-fit-together', label: 'Keep Fit Together', icon: '💪' },
  { id: 'weightloss', label: 'Lose Weight', icon: '⚖️' },
  { id: 'strength', label: 'Build Strength', icon: '💪' },
  { id: 'mental-health', label: 'Improve Mental Health', icon: '🧠' },
  { id: 'consistency', label: 'Stay Consistent', icon: '📅' },
  { id: 'athletic-performance', label: 'Train for an Event', icon: '🏅' },
  { id: 'charity', label: 'Support a Cause', icon: '❤️' },
  { id: 'workplace-wellness', label: 'Build Workplace Wellness', icon: '🏢' },
  { id: 'family-accountability', label: 'Family / Friends Accountability', icon: '👨‍👩‍👧' },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘' },
  { id: 'social', label: 'Social Connection', icon: '🤝' },
  { id: 'healthy-lifestyle', label: 'Healthy Lifestyle', icon: '🌿' },
  { id: 'accountability', label: 'Accountability', icon: '✅' },
  { id: 'other', label: 'Other', icon: '✍️' },
] as const;
