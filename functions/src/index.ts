import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/firestore';
import { onSchedule } from 'firebase-functions/scheduler';
import { rebuildAdminMetrics } from './adminMetricsCore.js';
import { expireEndedChallenges } from './challengeLifecycleJobs.js';
import {
  updateActiveChallengeCountForCreate,
  updateActiveChallengeCountForDelete,
  updateActiveChallengeCountForUpdate,
  updateGroupMemberCountForCreate,
  updateGroupMemberCountForDelete,
  updateGroupMemberCountForUpdate,
  updateParticipantCountForCreate,
  updateParticipantCountForDelete,
  updateParticipantCountForUpdate,
} from './memberCounters.js';
import {
  summarizeChallengeMemberCreated,
  summarizeGroupMemberCreated,
  summarizeWellnessLogCreated,
  summarizeWorkoutCreated,
} from './memberActivitySummaries.js';
import {
  rebuildUserMetricsForUser,
  refreshUserMetricsFromRecord,
} from './memberUserMetrics.js';
import { rebuildSupportDonationSummary } from './supportDonationSummary.js';
import {
  approveGroupJoinRequestCallable,
  createGroupInviteCallable,
  listGroupInvitesCallable,
  redeemGroupInviteCallable,
  rejectGroupJoinRequestCallable,
  requestGroupJoinCallable,
  revokeGroupInviteCallable,
} from './groupInviteBackend.js';
import { createChallengeFromAdminCallable, createChallengeWithCreatorMembershipCallable } from './challengeCreationBackend.js';

initializeApp();

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export const createGroupInvite = createGroupInviteCallable(db);
export const listGroupInvites = listGroupInvitesCallable(db);
export const revokeGroupInvite = revokeGroupInviteCallable(db);
export const redeemGroupInvite = redeemGroupInviteCallable(db);
export const requestGroupJoin = requestGroupJoinCallable(db);
export const approveGroupJoinRequest = approveGroupJoinRequestCallable(db);
export const rejectGroupJoinRequest = rejectGroupJoinRequestCallable(db);
export const createChallengeWithCreatorMembership = createChallengeWithCreatorMembershipCallable(db);
export const createChallengeFromAdmin = createChallengeFromAdminCallable(db);

export const refreshAdminMetrics = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'UTC',
    region: 'us-central1',
    retryCount: 3,
  },
  async (event) => {
    const startedAt = Date.now();
    logger.info('refreshAdminMetrics started', { scheduleTime: event.scheduleTime });

    try {
      const result = await rebuildAdminMetrics(db, {
        apply: true,
        generatedBy: 'scheduled-function',
        log: (message, data) => logger.info(message, data),
      });

      logger.info('refreshAdminMetrics completed', {
        durationMs: Date.now() - startedAt,
        readCounts: result.readCounts,
        writeCounts: result.writeCounts,
        metrics: result.metrics,
      });
    } catch (error) {
      logger.error('refreshAdminMetrics failed', {
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  },
);

export const expireChallengesOnSchedule = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'UTC',
    region: 'us-central1',
    retryCount: 3,
  },
  async (event) => {
    logger.info('expireChallengesOnSchedule started', { scheduleTime: event.scheduleTime });
    const count = await expireEndedChallenges(db);
    logger.info('expireChallengesOnSchedule completed', { expiredCount: count });
  },
);

export const onWorkoutCreatedUpdateMemberSummaries = onDocumentCreated(
  {
    document: 'workouts/{workoutId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await Promise.all([
      summarizeWorkoutCreated(db, event.params.workoutId, data),
      refreshUserMetricsFromRecord(db, data),
    ]);
  },
);

export const onWellnessLogCreatedUpdateMemberSummaries = onDocumentCreated(
  {
    document: 'wellnessLogs/{logId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await Promise.all([
      summarizeWellnessLogCreated(db, event.params.logId, data),
      refreshUserMetricsFromRecord(db, data),
    ]);
  },
);

export const onGroupMemberCreatedUpdateMemberSummaries = onDocumentCreated(
  {
    document: 'groupMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await summarizeGroupMemberCreated(db, event.params.membershipId, data);
  },
);

export const onChallengeMemberCreatedUpdateMemberSummaries = onDocumentCreated(
  {
    document: 'challengeMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await summarizeChallengeMemberCreated(db, event.params.membershipId, data);
  },
);

export const onGroupMemberWrittenUpdateUserMetrics = onDocumentWritten(
  {
    document: 'groupMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    const userId = String(after?.userId ?? before?.userId ?? '');
    if (!userId) return;
    await rebuildUserMetricsForUser(db, userId, {
      apply: true,
      generatedBy: 'trigger',
      log: (message, data) => logger.info(message, data),
    });
  },
);

export const onChallengeMemberWrittenUpdateUserMetrics = onDocumentWritten(
  {
    document: 'challengeMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    const userId = String(after?.userId ?? before?.userId ?? '');
    if (!userId) return;
    await rebuildUserMetricsForUser(db, userId, {
      apply: true,
      generatedBy: 'trigger',
      log: (message, data) => logger.info(message, data),
    });
  },
);

export const onSupportDonationWrittenUpdateSummary = onDocumentWritten(
  {
    document: 'supportDonations/{donationId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    logger.info('onSupportDonationWrittenUpdateSummary started', {
      donationId: event.params.donationId,
    });
    await rebuildSupportDonationSummary(db, {
      apply: true,
      generatedBy: 'trigger',
      log: (message, data) => logger.info(message, data),
    });
  },
);

export const onGroupMemberCreated = onDocumentCreated(
  {
    document: 'groupMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateGroupMemberCountForCreate(db, event.data?.data());
  },
);

export const onGroupMemberUpdated = onDocumentUpdated(
  {
    document: 'groupMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateGroupMemberCountForUpdate(db, event.data?.before.data(), event.data?.after.data());
  },
);

export const onGroupMemberDeleted = onDocumentDeleted(
  {
    document: 'groupMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateGroupMemberCountForDelete(db, event.data?.data());
  },
);

export const onChallengeCreated = onDocumentCreated(
  {
    document: 'challenges/{challengeId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateActiveChallengeCountForCreate(db, event.data?.data());
  },
);

export const onChallengeUpdated = onDocumentUpdated(
  {
    document: 'challenges/{challengeId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateActiveChallengeCountForUpdate(db, event.data?.before.data(), event.data?.after.data());
  },
);

export const onChallengeDeleted = onDocumentDeleted(
  {
    document: 'challenges/{challengeId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateActiveChallengeCountForDelete(db, event.data?.data());
  },
);

export const onChallengeMemberCreated = onDocumentCreated(
  {
    document: 'challengeMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateParticipantCountForCreate(db, event.data?.data());
  },
);

export const onChallengeMemberUpdated = onDocumentUpdated(
  {
    document: 'challengeMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateParticipantCountForUpdate(db, event.data?.before.data(), event.data?.after.data());
  },
);

export const onChallengeMemberDeleted = onDocumentDeleted(
  {
    document: 'challengeMembers/{membershipId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    await updateParticipantCountForDelete(db, event.data?.data());
  },
);
