import assert from 'node:assert/strict';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { rebuildUserMetricsForUser } from '../functions/src/memberUserMetrics';

type CapturedWrite = {
  path: string;
  data: Record<string, unknown>;
  options?: Record<string, unknown>;
};

function snapshotFrom(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    size: rows.length,
    docs: rows.map((row) => ({
      id: row.id,
      data: () => row.data,
    })),
  };
}

function collectionRef(name: string, writes: CapturedWrite[]) {
  const rowsByCollection: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {
    workouts: [
      {
        id: 'workout-1',
        data: {
          userId: 'test-user',
          completedAt: Timestamp.fromMillis(Date.parse('2026-06-13T10:00:00.000Z')),
        },
      },
    ],
    wellnessLogs: [],
    challengeMembers: [],
    groupMembers: [],
  };

  return {
    where: () => ({
      get: async () => snapshotFrom(rowsByCollection[name] ?? []),
    }),
    doc: (id: string) => ({
      path: `${name}/${id}`,
    }),
  };
}

const writes: CapturedWrite[] = [];
const fakeDb = {
  collection: (name: string) => collectionRef(name, writes),
  batch: () => ({
    set: (ref: { path: string }, data: Record<string, unknown>, options?: Record<string, unknown>) => {
      writes.push({ path: ref.path, data, options });
    },
    commit: async () => undefined,
  }),
};

const result = await rebuildUserMetricsForUser(fakeDb as never, 'test-user', {
  apply: true,
  generatedBy: 'backfill-script',
  now: new Date('2026-06-14T00:00:00.000Z'),
  serverTimestamp: () => FieldValue.serverTimestamp(),
  timestampFromMillis: (ms) => Timestamp.fromMillis(ms),
});

assert.equal(writes.length, 2, 'backfill should write userMetrics and memberHome');

const userMetricsWrite = writes.find((write) => write.path === 'userMetrics/test-user');
const memberHomeWrite = writes.find((write) => write.path === 'memberHome/test-user');

assert.ok(userMetricsWrite, 'userMetrics write should be planned');
assert.ok(memberHomeWrite, 'memberHome write should be planned');

const updatedAt = userMetricsWrite.data.updatedAt as Record<string, unknown>;
const generatedAt = memberHomeWrite.data.generatedAt as Record<string, unknown>;
const lastActivityAt = userMetricsWrite.data.lastActivityAt;

assert.equal(updatedAt?.constructor?.name, 'ServerTimestampTransform', 'userMetrics.updatedAt should use Admin SDK server timestamp');
assert.equal(generatedAt?.constructor?.name, 'ServerTimestampTransform', 'memberHome.generatedAt should use Admin SDK server timestamp');
assert.equal('_methodName' in updatedAt, false, 'userMetrics.updatedAt must not be a client SDK serverTimestamp sentinel');
assert.equal('_methodName' in generatedAt, false, 'memberHome.generatedAt must not be a client SDK serverTimestamp sentinel');
assert.ok(lastActivityAt instanceof Timestamp, 'userMetrics.lastActivityAt should use the writer Admin SDK Timestamp class');
assert.equal(lastActivityAt.toMillis(), Date.parse('2026-06-13T10:00:00.000Z'));
assert.equal(result.writeCounts.userMetrics, 1);
assert.equal(result.writeCounts.memberHome, 1);

console.log('user metrics backfill payload guard passed');
