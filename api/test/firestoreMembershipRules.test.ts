/**
 * EBC-01 CORR-001 Firestore membership rules tests (emulator-backed),
 * extended by CORR-002 with optional-field safety proofs (absent
 * isPrivate / requireAdminApproval default to public, never throw).
 *
 * Proves the tightened `groupMembers` rules close the direct-client
 * bypass around the governed server boundary: ordinary clients can only
 * perform the exact governed transitions (V1 GroupService parity), while
 * role promotion, approval bypass, identity fabrication, expelled
 * self-restore, and deletes are denied.
 *
 * REQUIRES a running Firestore emulator. This sandbox blocks TCP listen,
 * so these tests SKIP without FIRESTORE_EMULATOR_HOST and must be run
 * locally by Kenogo — see the completion report for the exact command.
 * Rules enforcement is therefore proven by the emulator here, never by
 * mocks alone.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const run = EMULATOR_HOST ? describe : describe.skip;

if (!EMULATOR_HOST) {
  console.log(
    'firestoreMembershipRules: skipped (set FIRESTORE_EMULATOR_HOST to run against the emulator)',
  );
}

const PROJECT_ID = 'demo-ebc01-corr';
const RULES_PATH = new URL('../../firestore.rules', import.meta.url);

function memberDoc(groupId: string, uid: string, overrides: Record<string, unknown> = {}) {
  return {
    groupId,
    userId: uid,
    role: 'member',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

run('firestore groupMembers governed transitions (emulator)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync(RULES_PATH, 'utf8'),
      },
    });
    await env.withSecurityRulesDisabled(async (admin) => {
      const store = admin.firestore();
      await setDoc(doc(store, 'users/admin1'), { role: 'admin' });
      await setDoc(doc(store, 'groups/pub'), {
        ownerId: 'owner1',
        status: 'active',
        moderationStatus: 'active',
      });
      await setDoc(doc(store, 'groups/pub2'), {
        ownerId: 'owner1',
        status: 'active',
        moderationStatus: 'active',
      });
      await setDoc(doc(store, 'groups/priv'), {
        ownerId: 'owner1',
        isPrivate: true,
        status: 'active',
        moderationStatus: 'active',
      });
      // EBC-01 CORR-002: legacy/default groups carry NEITHER optional
      // approval field; approval-flag group carries ONLY
      // requireAdminApproval (no isPrivate key at all).
      await setDoc(doc(store, 'groups/legacy'), {
        ownerId: 'owner1',
        status: 'active',
        moderationStatus: 'active',
      });
      await setDoc(doc(store, 'groups/flag'), {
        ownerId: 'owner1',
        requireAdminApproval: true,
        status: 'active',
        moderationStatus: 'active',
      });
      await setDoc(doc(store, 'groups/deact'), {
        ownerId: 'owner1',
        status: 'active',
        moderationStatus: 'deactivated',
      });
      await setDoc(doc(store, 'groups/arch'), {
        ownerId: 'owner1',
        status: 'archived',
        moderationStatus: 'active',
      });
      await setDoc(doc(store, 'groupMembers/pub_owner1'), {
        ...memberDoc('pub', 'owner1'),
        role: 'owner',
      });
      // One starting status per uid so transition tests never interfere.
      const starts: Array<[string, string]> = [
        ['member_active', 'active'],
        ['member_joined', 'joined'],
        ['member_pending', 'pending'],
        ['member_left', 'left'],
        ['member_rejected', 'rejected'],
        ['member_expelled', 'expelled'],
      ];
      for (const [uid, status] of starts) {
        await setDoc(doc(store, `groupMembers/pub_${uid}`), memberDoc('pub', uid, { status }));
      }
      await setDoc(doc(store, 'groupMembers/priv_left1'), memberDoc('priv', 'left1', { status: 'left' }));
      await setDoc(
        doc(store, 'groupMembers/legacy_left9'),
        memberDoc('legacy', 'left9', { status: 'left' }),
      );
    });
  }, 60000);

  afterAll(async () => {
    await env?.cleanup();
  });

  it('member join follows the group approval rule', async () => {
    const joiner = env.authenticatedContext('joiner1').firestore();
    await assertSucceeds(
      setDoc(doc(joiner, 'groupMembers/pub_joiner1'), memberDoc('pub', 'joiner1')),
    );
    const privateJoiner = env.authenticatedContext('joiner2').firestore();
    await assertFails(
      setDoc(
        doc(privateJoiner, 'groupMembers/priv_joiner2'),
        memberDoc('priv', 'joiner2', { status: 'active' }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(privateJoiner, 'groupMembers/priv_joiner2'),
        memberDoc('priv', 'joiner2', { status: 'pending' }),
      ),
    );
  });

  it('absent approval fields default to public; each flag alone requires pending', async () => {
    // 1 + 5: BOTH fields absent — ordinary active join succeeds, so no
    // rules evaluation error is produced on the legacy/default document.
    const legacyJoiner = env.authenticatedContext('legacy1').firestore();
    await assertSucceeds(
      setDoc(doc(legacyJoiner, 'groupMembers/legacy_legacy1'), memberDoc('legacy', 'legacy1')),
    );
    // 2: isPrivate=true requires pending (covered on priv), and still
    // denies an active join — repeated here to pin the semantic post-fix.
    const privJoiner = env.authenticatedContext('privlock1').firestore();
    await assertFails(
      setDoc(
        doc(privJoiner, 'groupMembers/priv_privlock1'),
        memberDoc('priv', 'privlock1', { status: 'active' }),
      ),
    );
    // 3: requireAdminApproval=true alone (no isPrivate key) requires
    // pending and denies an active join.
    const flagJoiner = env.authenticatedContext('flag1').firestore();
    await assertFails(
      setDoc(
        doc(flagJoiner, 'groupMembers/flag_flag1'),
        memberDoc('flag', 'flag1', { status: 'active' }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(flagJoiner, 'groupMembers/flag_flag1'),
        memberDoc('flag', 'flag1', { status: 'pending' }),
      ),
    );
    // 4: rejoin on a both-fields-absent group follows public behavior
    // (left→active allowed, no evaluation error).
    const legacyLeft = env.authenticatedContext('left9').firestore();
    await assertSucceeds(
      updateDoc(doc(legacyLeft, 'groupMembers/legacy_left9'), { status: 'active' }),
    );
  });

  it('role promotion and identity fabrication denied at create', async () => {
    const attacker = env.authenticatedContext('attacker1').firestore();
    await assertFails(
      setDoc(
        doc(attacker, 'groupMembers/pub_attacker1'),
        memberDoc('pub', 'attacker1', { role: 'admin' }),
      ),
    );
    await assertFails(
      setDoc(doc(attacker, 'groupMembers/pub_owner1'), memberDoc('pub', 'owner1')),
    );
    await assertFails(
      setDoc(doc(attacker, 'groupMembers/pub_attacker1'), memberDoc('priv', 'attacker1')),
    );
  });

  it('owner relation establishes only for the group owner; others refused', async () => {
    const owner = env.authenticatedContext('owner1').firestore();
    await assertSucceeds(
      setDoc(doc(owner, 'groupMembers/pub2_owner1'), {
        ...memberDoc('pub2', 'owner1'),
        role: 'owner',
      }),
    );
    const intruder = env.authenticatedContext('intruder1').firestore();
    await assertFails(
      setDoc(doc(intruder, 'groupMembers/pub2_intruder1'), {
        ...memberDoc('pub2', 'intruder1'),
        role: 'owner',
        status: 'active',
      }),
    );
  });

  it('joins on deactivated or archived groups denied', async () => {
    const member = env.authenticatedContext('frozen1').firestore();
    await assertFails(
      setDoc(doc(member, 'groupMembers/deact_frozen1'), memberDoc('deact', 'frozen1')),
    );
    await assertFails(
      setDoc(doc(member, 'groupMembers/arch_frozen1'), memberDoc('arch', 'frozen1')),
    );
  });

  it('leave and activation allowed; self-promotion and self-approval denied', async () => {
    const active = env.authenticatedContext('member_active').firestore();
    await assertSucceeds(updateDoc(doc(active, 'groupMembers/pub_member_active'), { status: 'left' }));
    await assertFails(updateDoc(doc(active, 'groupMembers/pub_member_active'), { role: 'admin' }));

    const pending = env.authenticatedContext('member_pending').firestore();
    await assertFails(updateDoc(doc(pending, 'groupMembers/pub_member_pending'), { status: 'active' }));

    const joined = env.authenticatedContext('member_joined').firestore();
    await assertSucceeds(
      updateDoc(doc(joined, 'groupMembers/pub_member_joined'), { status: 'active' }),
    );
  });

  it('rejoin follows the approval rule; expelled self-restore denied', async () => {
    const left = env.authenticatedContext('member_left').firestore();
    await assertSucceeds(updateDoc(doc(left, 'groupMembers/pub_member_left'), { status: 'active' }));

    const privLeft = env.authenticatedContext('left1').firestore();
    await assertFails(updateDoc(doc(privLeft, 'groupMembers/priv_left1'), { status: 'active' }));
    await assertSucceeds(updateDoc(doc(privLeft, 'groupMembers/priv_left1'), { status: 'pending' }));

    const expelled = env.authenticatedContext('member_expelled').firestore();
    await assertFails(
      updateDoc(doc(expelled, 'groupMembers/pub_member_expelled'), { status: 'active' }),
    );
  });

  it('cross-user writes and deletes denied; admin moderation preserved', async () => {
    const member = env.authenticatedContext('member_active').firestore();
    await assertFails(updateDoc(doc(member, 'groupMembers/pub_owner1'), { status: 'left' }));
    await assertFails(deleteDoc(doc(member, 'groupMembers/pub_member_active')));

    const admin = env.authenticatedContext('admin1').firestore();
    await assertSucceeds(
      updateDoc(doc(admin, 'groupMembers/pub_member_rejected'), {
        status: 'expelled',
        moderatedBy: 'admin1',
      }),
    );
  });
});
