import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { V2ChallengeSummary } from '../src/api/v2ChallengeApi.js';
import { filterChallengeDiscovery, lifecycleBucket } from '../src/v2/challenges/challengeDiscovery.js';
import { inclusiveDurationDays } from '../src/v2/challenges/challengeCreationDraft.js';

let failures = 0;
function check(label: string, ok: boolean): void {
  if (!ok) { failures += 1; console.error(`FAIL ${label}`); }
  else console.log(`ok ${label}`);
}
const challenge = (overrides: Partial<V2ChallengeSummary> = {}): V2ChallengeSummary => ({
  challengeId: 'challenge-id', groupId: 'group-id', groupName: 'Morning Movers', activities: [
    { name: 'Push-Up', domain: 'fitness', category: 'Strength', subcategory: 'Bodyweight' },
  ], title: 'Morning Push-Up Week', description: 'Build consistency', challengeType: 'collective', status: 'active',
  startDate: '2026-10-01', endDate: '2026-10-14', timezone: 'Africa/Bujumbura', governingToday: '2026-10-02',
  finalized: false, currentConfigVersion: 1, goalValue: 100, goalUnit: 'reps', collectiveTotal: 0,
  collectiveGoalReached: false, completionsCount: 0, myParticipation: null, ...overrides,
});
const active = challenge();
const upcoming = challenge({ challengeId: 'upcoming', status: 'establishment', governingToday: '2026-09-30' });
const completed = challenge({ challengeId: 'done', status: 'ended', finalized: true });
check('lifecycle labels derive from served Challenge state', lifecycleBucket(active) === 'active'
  && lifecycleBucket(upcoming) === 'upcoming' && lifecycleBucket(completed) === 'completed');
check('type and domain filters use canonical types and Knowledge domain', filterChallengeDiscovery([active], { search: '', lifecycle: 'all', type: 'collective', domain: 'fitness' }).length === 1
  && filterChallengeDiscovery([active], { search: '', lifecycle: 'all', type: 'streak', domain: 'all' }).length === 0
  && filterChallengeDiscovery([active], { search: '', lifecycle: 'all', type: 'all', domain: 'wellness' }).length === 0);
check('search matches title, description, Group, Activity, domain, and category', ['push-up', 'morning movers', 'consistency', 'fitness', 'bodyweight'].every((term) =>
  filterChallengeDiscovery([active], { search: term, lifecycle: 'all', type: 'all', domain: 'all' }).length === 1));
check('custom date duration is inclusive and date-only', inclusiveDurationDays('2026-10-01', '2026-10-07') === 7
  && inclusiveDurationDays('2026-10-08', '2026-10-07') === null);

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const list = read('src/v2/challenges/V2ChallengeListScreen.tsx');
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
const detail = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
const draft = read('src/v2/challenges/challengeCreationDraft.ts');
const members = read('api/src/memberships.ts');
const review = wizard.slice(wizard.indexOf('function StepReview'), wizard.indexOf('function ReviewCard'));
check('list search and clear field filters are present with progressive expansion', list.includes('Search Challenges')
  && list.includes('Active / Ongoing') && list.includes('Scheduled / Upcoming') && list.includes('Completed')
  && list.includes('View more Challenges') && list.includes('INITIAL_RESULTS = 8'));
check('Challenge result rows remain single-column and omit full descriptions', list.includes('ul className="space-y-2"')
  && !list.includes('line-clamp-2') && list.includes('challenge.activities.map'));
check('host selector is searchable and excludes restricted non-steward memberships', wizard.includes('Search Groups')
  && wizard.includes('allowMemberChallenges !== false') && wizard.includes("membership.role.toLowerCase()"));
const hostStep = wizard.slice(wizard.indexOf('function StepHosting'), wizard.indexOf('function StepChallengeDetails'));
const detailsStep = wizard.slice(wizard.indexOf('function StepChallengeDetails'), wizard.indexOf('function StepActivities'));
check('Challenge title/description have their own third wizard step', draft.includes("'CHALLENGE_DETAILS'")
  && wizard.includes('StepChallengeDetails') && !hostStep.includes('Challenge title')
  && detailsStep.includes('Challenge title') && detailsStep.includes('Description'));
check('What Counts copy is schedule-independent and Together uses the Shared goal label', !draft.includes('over ${duration}')
  && !draft.includes('before the day ends in ${timezone}') && wizard.includes("type === 'collective' ? 'Shared goal'"));
check('Review avoids duplicating the persistent Challenge summary', !review.includes('summarize(state)'));
check('preset and custom dates set inclusive end/duration, with no timezone selector', wizard.includes('Custom')
  && wizard.includes('inclusiveDurationDays') && !wizard.includes('Time setting')
  && draft.includes('Intl.DateTimeFormat().resolvedOptions().timeZone'));
check('creator local timezone remains an internal Challenge config value', draft.includes('timezone: creatorTimezone()')
  && wizard.includes('Dates use your local time'));
check('completed reuse submits only a fresh wizard draft through governed creation', detail.includes("endState === 'finalized'")
  && detail.includes('Use as new Challenge')
  && detail.includes('createChallengeWizardRouteState(draft, 0') && detail.includes('creatorJoins: false')
  && detail.includes('fetchKnowledgeByCode') && detail.includes('fetchKnowledgeById'));
check('host permission uses the existing Group metadata contract', members.includes('allow_member_challenges AS group_allow_member_challenges'));

if (failures) process.exit(1);
console.log('Challenge discovery guards passed.');
