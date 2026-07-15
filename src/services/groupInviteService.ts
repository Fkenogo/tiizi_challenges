import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { app, db } from '../lib/firebase';
import {
  calculateGroupInviteAnalytics,
  normalizeInviteTokenInput,
  normalizeCreateGroupInviteInput,
  type CreateGroupInviteInput,
  type GroupInvite,
  type GroupInviteAnalytics,
} from './groupInviteUtils';

export { calculateGroupInviteAnalytics, normalizeCreateGroupInviteInput };
export type { CreateGroupInviteInput, GroupInvite, GroupInviteAnalytics };

export type CreatedGroupInvite = {
  inviteId: string;
  token: string;
};

export type RedeemedGroupInvite = {
  inviteId: string;
  groupId: string;
  status: 'joined';
};

export type GroupJoinRequest = {
  id: string;
  groupId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  requestedAt: unknown;
  source: 'request' | 'invite' | string;
  inviteId: string | null;
  approvedBy?: string | null;
  approvedAt?: unknown;
  rejectedBy?: string | null;
  rejectedAt?: unknown;
  rejectionReason?: string | null;
};

const functions = getFunctions(app, 'us-central1');

class GroupInviteService {
  async createGroupInvite(input: CreateGroupInviteInput): Promise<CreatedGroupInvite> {
    const callable = httpsCallable<typeof input, CreatedGroupInvite>(functions, 'createGroupInvite');
    const result = await callable(normalizeCreateGroupInviteInput(input) as typeof input);
    return result.data;
  }

  async revokeGroupInvite(inviteId: string): Promise<{ inviteId: string; status: 'revoked' }> {
    const normalizedInviteId = inviteId.trim();
    if (!normalizedInviteId) throw new Error('Invite is required.');
    const callable = httpsCallable<{ inviteId: string }, { inviteId: string; status: 'revoked' }>(functions, 'revokeGroupInvite');
    const result = await callable({ inviteId: normalizedInviteId });
    return result.data;
  }

  async redeemGroupInvite(token: string): Promise<RedeemedGroupInvite> {
    const normalizedToken = normalizeInviteTokenInput(token);
    if (!normalizedToken) throw new Error('Invite token is required.');
    const callable = httpsCallable<{ token: string }, RedeemedGroupInvite>(functions, 'redeemGroupInvite');
    const result = await callable({ token: normalizedToken });
    return result.data;
  }

  async requestGroupJoin(groupId: string): Promise<{ requestId: string; status: 'pending' }> {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) throw new Error('Group is required.');
    const callable = httpsCallable<{ groupId: string; source: 'request' }, { requestId: string; status: 'pending' }>(
      functions,
      'requestGroupJoin',
    );
    const result = await callable({ groupId: normalizedGroupId, source: 'request' });
    return result.data;
  }

  async approveGroupJoinRequest(requestId: string): Promise<{ requestId: string; status: 'approved' }> {
    const normalizedRequestId = requestId.trim();
    if (!normalizedRequestId) throw new Error('Request is required.');
    const callable = httpsCallable<{ requestId: string }, { requestId: string; status: 'approved' }>(
      functions,
      'approveGroupJoinRequest',
    );
    const result = await callable({ requestId: normalizedRequestId });
    return result.data;
  }

  async rejectGroupJoinRequest(
    requestId: string,
    rejectionReason?: string,
  ): Promise<{ requestId: string; status: 'rejected' }> {
    const normalizedRequestId = requestId.trim();
    if (!normalizedRequestId) throw new Error('Request is required.');
    const callable = httpsCallable<
      { requestId: string; rejectionReason?: string },
      { requestId: string; status: 'rejected' }
    >(functions, 'rejectGroupJoinRequest');
    const result = await callable({
      requestId: normalizedRequestId,
      ...(rejectionReason?.trim() ? { rejectionReason: rejectionReason.trim().slice(0, 500) } : {}),
    });
    return result.data;
  }

  async listGroupInvites(groupId: string): Promise<GroupInvite[]> {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) throw new Error('Group is required.');
    const callable = httpsCallable<{ groupId: string }, { invites: GroupInvite[] }>(functions, 'listGroupInvites');
    const result = await callable({ groupId: normalizedGroupId });
    return result.data.invites.map((invite) => ({
      ...invite,
      maxUses: Number(invite.maxUses ?? 0),
      useCount: Number(invite.useCount ?? 0),
    }));
  }

  async getInviteAnalytics(groupId: string): Promise<GroupInviteAnalytics> {
    const invites = await this.listGroupInvites(groupId);
    return calculateGroupInviteAnalytics(invites);
  }

  async listGroupJoinRequests(groupId: string): Promise<GroupJoinRequest[]> {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) throw new Error('Group is required.');
    const snap = await getDocs(
      query(
        collection(db, 'groupJoinRequests'),
        where('groupId', '==', normalizedGroupId),
        limit(50),
      ),
    );

    return snap.docs
      .map((doc) => {
        const data = doc.data() as Omit<GroupJoinRequest, 'id'>;
        return {
          id: doc.id,
          groupId: String(data.groupId ?? ''),
          userId: String(data.userId ?? ''),
          status: String(data.status ?? ''),
          requestedAt: data.requestedAt ?? null,
          source: String(data.source ?? 'request'),
          inviteId: data.inviteId ?? null,
          approvedBy: data.approvedBy ?? null,
          approvedAt: data.approvedAt ?? null,
          rejectedBy: data.rejectedBy ?? null,
          rejectedAt: data.rejectedAt ?? null,
          rejectionReason: data.rejectionReason ?? null,
        };
      })
      .sort((a, b) => String(b.requestedAt ?? '').localeCompare(String(a.requestedAt ?? '')));
  }
}

export const groupInviteService = new GroupInviteService();
