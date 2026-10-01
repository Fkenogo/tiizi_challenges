import { beforeEach, describe, expect, it } from 'vitest';
import { processScheduledChallengeStarts } from '../src/challengeFinalization.js';
import { runLifecycleCommand } from '../src/challengeLifecycleCli.js';
import { activateChallenge, getChallenge } from '../src/challenges.js';
import { seedGroup, seedMember, testDb } from './helpers.js';
import type { Db } from '../src/db.js';

const BEFORE_START = new Date('2026-10-01T21:59:59.000Z');
const START_BOUNDARY = new Date('2026-10-01T22:00:00.000Z');
const AFTER_START = new Date('2026-10-02T06:00:00.000Z');

let db: Db;
let seq = 0;

beforeEach(async () => {
  db = testDb();
  await db.query('TRUNCATE challenge_social_cause_decisions, challenge_social_causes, challenges CASCADE');
});

async function challenge(options: {
  title: string;
  startDate?: string;
  supportTiizi?: boolean;
  causeStatus?: 'pending_approval' | 'approved' | 'revision_required' | 'removed';
}): Promise<string> {
  const creatorId = await seedMember(db, `scheduled-lifecycle-${++seq}`);
  const groupId = await seedGroup(db, { name: `Scheduled lifecycle ${seq}` });
  const row = await db.query<{ challenge_id: string }>(
    `INSERT INTO challenges
      (group_id,created_by_member_id,challenge_type,status,title,start_date,end_date,
       required_consecutive_days,timezone,support_tiizi_enabled)
     VALUES ($1,$2,'streak','establishment',$3,$4,'2026-10-10',1,'Africa/Bujumbura',$5)
     RETURNING challenge_id`,
    [groupId, creatorId, options.title, options.startDate ?? '2026-10-02', options.supportTiizi ?? false],
  );
  const challengeId = row.rows[0].challenge_id;
  if (options.causeStatus) {
    const authorityId = options.causeStatus === 'approved' || options.causeStatus === 'revision_required'
      ? creatorId
      : null;
    await db.query(
      `INSERT INTO challenge_social_causes
        (challenge_id,title,description,purpose,beneficiary,payment_destination_reference,
         destination_owner,approval_status,approval_authority,decision_at,decision_reason)
       VALUES ($1,'Local Cause','Local description','Local purpose','Local beneficiary',
         'beneficiary-reference','beneficiary',$2,$3,CASE WHEN $3::uuid IS NULL THEN NULL ELSE now() END,
         CASE WHEN $3::uuid IS NULL THEN NULL ELSE 'test fixture decision' END)`,
      [challengeId, options.causeStatus, authorityId],
    );
  }
  return challengeId;
}

describe('scheduled Challenge lifecycle advancement', () => {
  it('leaves a future ordinary Challenge establishing before start and activates it at the Challenge-local day boundary', async () => {
    const challengeId = await challenge({ title: 'Ordinary scheduled Challenge' });
    await expect(activateChallenge(db, challengeId, BEFORE_START)).rejects.toThrow(/before scheduled start/);

    const early = await processScheduledChallengeStarts(db, BEFORE_START);
    expect(early.find((row) => row.challenge_id === challengeId)).toMatchObject({ due: false, activated: false });
    expect((await getChallenge(db, challengeId)).status).toBe('establishment');

    const due = await processScheduledChallengeStarts(db, START_BOUNDARY);
    expect(due.find((row) => row.challenge_id === challengeId)).toMatchObject({ due: true, activated: true, blockedBy: null });
    expect((await getChallenge(db, challengeId)).status).toBe('active');
  });

  it('keeps a pending Cause in establishment after its scheduled start', async () => {
    const challengeId = await challenge({ title: 'Pending Cause Challenge', causeStatus: 'pending_approval' });
    const due = await processScheduledChallengeStarts(db, START_BOUNDARY);
    expect(due.find((row) => row.challenge_id === challengeId)).toMatchObject({
      due: true, activated: false, blockedBy: 'cause_approval',
    });
    expect((await getChallenge(db, challengeId)).status).toBe('establishment');
    await expect(db.query("UPDATE challenges SET status='active' WHERE challenge_id=$1", [challengeId]))
      .rejects.toThrow(/approved Social Cause/);
  });

  it('keeps an approved Cause scheduled until start, then activates it through the shared lifecycle seam', async () => {
    const challengeId = await challenge({ title: 'Approved Future Cause', causeStatus: 'approved' });
    expect((await processScheduledChallengeStarts(db, BEFORE_START)).find((row) => row.challenge_id === challengeId))
      .toMatchObject({ due: false, activated: false });
    expect((await getChallenge(db, challengeId)).status).toBe('establishment');

    expect((await processScheduledChallengeStarts(db, START_BOUNDARY)).find((row) => row.challenge_id === challengeId))
      .toMatchObject({ due: true, activated: true });
    expect((await getChallenge(db, challengeId)).status).toBe('active');
  });

  it('starts a Support Tiizi-only Challenge normally without a Cause approval gate', async () => {
    const challengeId = await challenge({ title: 'Support Tiizi scheduled Challenge', supportTiizi: true });
    expect((await processScheduledChallengeStarts(db, AFTER_START)).find((row) => row.challenge_id === challengeId))
      .toMatchObject({ due: true, activated: true, blockedBy: null });
    expect((await getChallenge(db, challengeId)).status).toBe('active');
  });

  it('runs the existing lifecycle CLI entrypoint for scheduled starts', async () => {
    const challengeId = await challenge({ title: 'CLI scheduled Challenge' });
    await runLifecycleCommand(db, ['process-lifecycle', '--now', START_BOUNDARY.toISOString()]);
    expect((await getChallenge(db, challengeId)).status).toBe('active');
  });

  it('keeps revision-required Cause blocked when its scheduled start has arrived', async () => {
    const challengeId = await challenge({ title: 'Revision Cause Challenge', causeStatus: 'revision_required' });
    expect((await processScheduledChallengeStarts(db, AFTER_START)).find((row) => row.challenge_id === challengeId))
      .toMatchObject({ due: true, activated: false, blockedBy: 'cause_approval' });
    expect((await getChallenge(db, challengeId)).status).toBe('establishment');
  });

  it('allows a removed Cause through the ordinary scheduled lifecycle after its start', async () => {
    const challengeId = await challenge({ title: 'Removed Cause Challenge', causeStatus: 'removed' });
    const result = await processScheduledChallengeStarts(db, AFTER_START);
    expect(result.find((row) => row.challenge_id === challengeId))
      .toMatchObject({ due: true, activated: true, blockedBy: null });
    expect((await getChallenge(db, challengeId)).status).toBe('active');
  });
});
