import 'dotenv/config';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

type FlaggedRow = {
  challengeId: string;
  challengeName: string;
  challengeStatus: string;
  endDate: string;
  endDateInFuture: boolean;
  userId: string;
  memberStatus: string;
  completionRate: number;
  activitiesCompleted: number;
  totalActivities: number;
  issue: string;
};

async function run() {
  const now = Date.now();

  const [challengesSnap, completedMembersSnap] = await Promise.all([
    db.collection('challenges').get(),
    db.collection('challengeMembers').where('status', '==', 'completed').get(),
  ]);

  const challenges = new Map<string, Record<string, unknown>>();
  for (const doc of challengesSnap.docs) {
    challenges.set(doc.id, { id: doc.id, ...doc.data() });
  }

  console.log(`\nTotal challenges: ${challenges.size}`);
  console.log(`Total completed memberships: ${completedMembersSnap.size}`);

  const flagged: FlaggedRow[] = [];
  const challengesWithIssue = new Map<string, string>();

  for (const memberDoc of completedMembersSnap.docs) {
    const m = memberDoc.data() as Record<string, unknown>;
    const challengeId = String(m.challengeId ?? '');
    const challenge = challenges.get(challengeId);
    if (!challenge) continue;

    const challengeStatus = String(challenge.status ?? '');
    const endDate = String(challenge.endDate ?? '');
    const endMs = Date.parse(endDate);
    const endDateInFuture = !Number.isNaN(endMs) && endMs > now;

    const issueA = challengeStatus === 'active'; // challenge still active
    const issueB = endDateInFuture;              // end date still in the future

    if (issueA || issueB) {
      const issues: string[] = [];
      if (issueA) issues.push('challenge.status=active');
      if (issueB) issues.push('endDate in future');
      flagged.push({
        challengeId,
        challengeName: String(challenge.name ?? '').slice(0, 40),
        challengeStatus,
        endDate: endDate.slice(0, 10),
        endDateInFuture,
        userId: String(m.userId ?? '').slice(0, 20),
        memberStatus: 'completed',
        completionRate: Number(m.completionRate ?? 0),
        activitiesCompleted: Number(m.activitiesCompleted ?? 0),
        totalActivities: Number(m.totalActivities ?? 0),
        issue: issues.join(' + '),
      });
      challengesWithIssue.set(challengeId, String(challenge.name ?? ''));
    }
  }

  // Query active members with completionRate=100 and endDate in future
  const active100Snap = await db.collection('challengeMembers')
    .where('status', '==', 'active')
    .where('completionRate', '==', 100)
    .get();

  const stuckActive: FlaggedRow[] = [];
  for (const memberDoc of active100Snap.docs) {
    const m = memberDoc.data() as Record<string, unknown>;
    const challengeId = String(m.challengeId ?? '');
    const challenge = challenges.get(challengeId);
    if (!challenge) continue;
    const endDate = String(challenge.endDate ?? '');
    const endMs = Date.parse(endDate);
    if (!Number.isNaN(endMs) && endMs > now) {
      stuckActive.push({
        challengeId,
        challengeName: String(challenge.name ?? '').slice(0, 40),
        challengeStatus: String(challenge.status ?? ''),
        endDate: endDate.slice(0, 10),
        endDateInFuture: true,
        userId: String(m.userId ?? '').slice(0, 20),
        memberStatus: 'active',
        completionRate: Number(m.completionRate ?? 0),
        activitiesCompleted: Number(m.activitiesCompleted ?? 0),
        totalActivities: Number(m.totalActivities ?? 0),
        issue: 'completionRate=100 but challenge end date still in future',
      });
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`A. Memberships: status=completed, challenge=active or endDate future`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Count: ${flagged.length}`);
  if (flagged.length > 0) {
    console.table(flagged.map((r) => ({
      challengeId: r.challengeId.slice(0, 14),
      challengeName: r.challengeName,
      challengeStatus: r.challengeStatus,
      endDate: r.endDate,
      endFuture: r.endDateInFuture,
      userId: r.userId,
      compRate: r.completionRate,
      actComp: r.activitiesCompleted,
      totalAct: r.totalActivities,
      issue: r.issue,
    })));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`B. Memberships: status=active, completionRate=100, endDate future`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Count: ${stuckActive.length}`);
  if (stuckActive.length > 0) {
    console.table(stuckActive.map((r) => ({
      challengeId: r.challengeId.slice(0, 14),
      name: r.challengeName,
      endDate: r.endDate,
      userId: r.userId,
      compRate: r.completionRate,
      actComp: r.activitiesCompleted,
      totalAct: r.totalActivities,
    })));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('C. Distinct challenges affected');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const [id, name] of challengesWithIssue.entries()) {
    console.log(`  ${id}  ${name}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('D. Proposed repair: fields that WOULD be written per flagged membership');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('For each membership in list A (premature completed → revert to active):');
  console.log(JSON.stringify({ status: 'active', completedAt: null }, null, 2));
  console.log('\nZero writes performed — DRY-RUN only.');
}

run().catch((err) => { console.error(err); process.exit(1); });
