/**
 * Deterministic, idempotent Cause-review fixtures for LOCAL Development only.
 *
 * This seeds two explicit review exercises using a real non-operator creator
 * and an existing Development Group. They are establishment Challenges
 * intended only to exercise the existing governed Cause review API; the
 * existing full Challenge/progress dataset remains untouched.
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { createPool, databaseUrl } from '../api/src/db.js';

config({ path: 'api/.env', override: false });

const FIXTURES = [
  {
    title: 'LOCAL PREVIEW — Cause Approval Exercise 001',
    causeTitle: 'LOCAL PREVIEW — Community Garden Repair',
    supportTiiziEnabled: false,
    description: 'Development review fixture for the existing Social Cause approval workflow.',
    purpose: 'Repair raised beds at the community garden.',
    beneficiary: 'Community Garden Trust (local preview fixture)',
    destination: 'local-preview-beneficiary-reference-approval-001',
  },
  {
    title: 'LOCAL PREVIEW — Cause Revision Exercise 001',
    causeTitle: 'LOCAL PREVIEW — Neighbourhood Garden Tools',
    supportTiiziEnabled: true,
    description: 'Development review fixture for the existing Social Cause revision workflow.',
    purpose: 'Replace shared tools used by neighbourhood volunteers.',
    beneficiary: 'Neighbourhood Garden Trust (local preview fixture)',
    destination: 'local-preview-beneficiary-reference-revision-001',
  },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed the Operator preview in production.');
  const url = new URL(databaseUrl());
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Operator preview seeding requires loopback PostgreSQL.');
  const db = createPool(url.toString(), { max: 1 });
  try {
    const result = await db.transaction(async (tx) => {
      const operators = await tx.query<{ member_id: string }>(
        `SELECT member_id FROM platform_operator_cause_reviewers WHERE revoked_at IS NULL ORDER BY member_id`,
      );
      if (operators.rows.length !== 1) throw new Error('Expected exactly one active local Platform Operator roster entry.');
      const source = await tx.query<{ group_id: string; created_by_member_id: string }>(
        `SELECT h.group_id,h.created_by_member_id FROM challenges h
         JOIN challenge_social_causes c USING(challenge_id)
         WHERE c.approval_status='pending_approval' AND h.created_by_member_id<>$1
         ORDER BY c.created_at,h.challenge_id LIMIT 1`,
        [operators.rows[0].member_id],
      );
      if (!source.rows[0]) throw new Error('A pending Cause by a non-operator Development member is required before seeding review fixtures.');

      const created: string[] = [];
      for (const fixture of FIXTURES) {
        const existing = await tx.query<{ challenge_id: string }>(
          `SELECT challenge_id FROM challenges WHERE title=$1`, [fixture.title],
        );
        if (existing.rows[0]) {
          created.push(`retained ${fixture.title}`);
          continue;
        }
        const challenge = await tx.query<{ challenge_id: string }>(
          `INSERT INTO challenges
             (group_id,created_by_member_id,challenge_type,status,title,description,start_date,end_date,
              required_consecutive_days,support_tiizi_enabled)
           VALUES ($1,$2,'streak','establishment',$3,$4,'2026-10-10','2026-10-20',3,$5)
           RETURNING challenge_id`,
          [source.rows[0].group_id, source.rows[0].created_by_member_id, fixture.title, fixture.description, fixture.supportTiiziEnabled],
        );
        const challengeId = String(challenge.rows[0].challenge_id);
        await tx.query(
          `INSERT INTO challenge_social_causes
             (challenge_id,title,description,purpose,beneficiary,payment_destination_reference,destination_owner)
           VALUES ($1,$2,$3,$4,$5,$6,'beneficiary')`,
          [challengeId, fixture.causeTitle, fixture.description, fixture.purpose, fixture.beneficiary, fixture.destination],
        );
        created.push(`created ${fixture.title}`);
      }
      const summary = await tx.query<{ members: number; groups: number; challenges: number; causes: number; participations: number }>(
        `SELECT (SELECT count(*)::int FROM members) AS members,
                (SELECT count(*)::int FROM groups) AS groups,
                (SELECT count(*)::int FROM challenges) AS challenges,
                (SELECT count(*)::int FROM challenge_social_causes) AS causes,
                (SELECT count(*)::int FROM challenge_participations) AS participations`,
      );
      return { created, counts: summary.rows[0] };
    });
    console.log('Local Platform Operator preview seed ready.');
    for (const item of result.created) console.log(`  ${item}`);
    console.log(`  existing data summary: ${result.counts.members} members, ${result.counts.groups} Groups, ${result.counts.challenges} Challenges, ${result.counts.causes} Causes, ${result.counts.participations} participations`);
  } finally {
    await db.close();
  }
}

void main().catch((error: unknown) => {
  console.error(`Operator preview seeding failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
