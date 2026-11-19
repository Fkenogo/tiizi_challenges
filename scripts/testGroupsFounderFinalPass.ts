import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const groupsScreen = readFileSync('src/v2/groups/V2GroupsScreen.tsx', 'utf8');
const globalSearch = readFileSync('src/v2/groups/V2GroupGlobalSearch.tsx', 'utf8');
const discoverPanel = readFileSync('src/v2/groups/V2GroupDiscoveryPanel.tsx', 'utf8');
const homeScreen = readFileSync('src/v2/groups/V2GroupHomeScreen.tsx', 'utf8');
const createScreen = readFileSync('src/v2/groups/V2CreateGroupScreen.tsx', 'utf8');
const membershipApi = readFileSync('api/src/memberships.ts', 'utf8');
const discoveryApi = readFileSync('api/src/groupDiscovery.ts', 'utf8');
const testHelpers = readFileSync('api/test/helpers.ts', 'utf8');
const sheetPrimitives = readFileSync('src/v2/components/V2Primitives.tsx', 'utf8');

assert.match(groupsScreen, /Search all Groups/, 'one global Group search is presented above browse modes');
assert.match(groupsScreen, /searchQuery\.trim\(\)\.length > 0 \?[\s\S]*?: \([\s\S]*aria-label="Groups"/, 'My Groups and Discover browse tabs remain when global search is inactive');
assert.match(globalSearch, /useV2GroupDiscovery/, 'global search uses governed discoverable search');
assert.match(globalSearch, /pending|Discoverable · Not joined/, 'search results identify governed relationships');
assert.match(globalSearch, /memberships/, 'global search includes authenticated member Groups');
assert.match(globalSearch, /matchesQuery\(group, query\)/, 'member search matches governed searchable Group metadata');
assert.match(globalSearch, /INITIAL_RESULT_COUNT/, 'search results are progressively bounded');
assert.doesNotMatch(discoverPanel, /Search Groups<V2TextInput/, 'Discover does not introduce a second search field');
assert.match(discoveryApi, /g\.status='active' AND g\.is_private=false/, 'server search excludes private and inactive discoverable Groups');
assert.match(discoveryApi, /custom_goal.*ILIKE|ILIKE.*custom_goal/, 'server search includes custom Group Goal metadata');
assert.match(homeScreen, /<V2Sheet open=\{aboutOpen\}/, 'About this Group uses the existing V2 sheet');
// The Escape dismissal lives in the shared V2Sheet primitive (the sheet owns
// its keydown handling); the Group Home owns the browser-history dismissal.
// Assert the accepted mechanism rather than an inline handler that no
// longer exists in this screen.
assert.match(sheetPrimitives, /event\.key === 'Escape'/, 'About this Group closes on Escape (the shared V2 sheet owns the Escape dismissal)');
assert.match(homeScreen, /window\.history\.back\(\)/, 'About this Group dismissal returns through browser history');
assert.doesNotMatch(homeScreen, /aboutOpen && <section/, 'About content is not expanded inline');
assert.match(createScreen, /label: 'Our culture'/, 'Step 4 uses the approved member-facing label');
assert.match(createScreen, /Step 4 — Our culture/, 'Step 4 heading uses the approved member-facing label');
assert.match(createScreen, /Community norms \(optional\)/, 'Community Norm concept remains unchanged');
assert.match(membershipApi, /g\.goal_ids AS group_goal_ids/, 'member Group reads expose canonical Goal metadata for search');
assert.match(testHelpers, /afterAll\(async \(\) => \{\s*if \(db\) await db\.close\(\);/, 'API test files close their PGlite database after each suite');

console.log('Groups Founder final-pass guards: PASS');
