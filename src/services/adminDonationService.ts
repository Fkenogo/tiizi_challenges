import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SupportDonationSettings } from '../types';

export type PlatformSupportAction = 'confirm' | 'reject' | 'flag' | 'unflag' | 'note' | 'refund';

export type CampaignStatus = 'active' | 'paused' | 'suspended' | 'completed' | 'draft' | 'pending_approval';

export type PlatformSupportDonation = {
  id: string;
  userId: string;
  donorName: string;
  donorEmail?: string;
  amountKes: number;
  currency?: string;
  frequency: string;
  paymentMethod: string;
  status: 'intent' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'refunded' | 'cancelled';
  flagged?: boolean;
  transactionId?: string;
  note?: string;
  adminNote?: string;
  confirmedAt?: string;
  createdAt: string;
};

export type DonationCampaign = {
  id: string;
  name: string;
  /** platform_support = Tiizi App Support (virtual); challenge_cause = group challenge cause; legacy = old donationCampaigns docs */
  source: 'platform_support' | 'challenge_cause' | 'legacy';
  currency: string;
  goalAmount: number;
  /** Sum of confirmed pledge amounts (numeric total, mixed currencies). */
  confirmedAmount: number;
  /** Sum of pledged-but-not-confirmed amounts (numeric total, mixed currencies). */
  pendingAmount: number;
  /** Per-currency breakdown of confirmed amounts. */
  confirmedByCurrency: Record<string, number>;
  /** Per-currency breakdown of pending amounts. */
  pendingByCurrency: Record<string, number>;
  /** Alias for confirmedAmount — kept for display compatibility. */
  raisedAmount: number;
  /** Unique contributors who confirmed. */
  contributorCount: number;
  /** All unique pledgers (confirmed + pending). */
  donorCount: number;
  status: CampaignStatus;
  /** Admin-set campaign status for cause campaigns (separate from challenge lifecycle). */
  campaignStatus?: 'active' | 'paused' | 'suspended' | 'completed';
  startDate: string;
  endDate: string;
  /** Cause campaign contribution window — from challenge.donation.contributionStartDate/EndDate. */
  timingStartDate?: string;
  timingEndDate?: string;
  /** For challenge cause campaigns. */
  challengeId?: string;
  challengeName?: string;
  approvalStatus?: string;
};

export type DonationTransaction = {
  id: string;
  campaignId: string;
  campaignName: string;
  causeName?: string;
  donorName: string;
  donorEmail: string;
  amount: number;
  currency: string;
  /** pledged = user intent only; confirmed_by_user = user marked as sent; success = legacy payment success */
  status: 'pledged' | 'confirmed_by_user' | 'success' | 'pending' | 'failed' | 'refunded';
  createdAt: string;
  confirmedAt?: string;
  source: 'platform_support' | 'challenge_cause' | 'legacy';
  transactionId?: string;
};

export type DonationReports = {
  totalDonationsAllTime: number;
  totalDonations30d: number;
  avgDonationAmount: number;
  topCampaigns: Array<{ campaignId: string; name: string; raisedAmount: number; currency: string }>;
  bySource: Record<'platform_support' | 'challenge_cause' | 'legacy', number>;
};

export type AdminChallengePledge = {
  id: string;
  challengeId: string;
  userId: string;
  displayName?: string;
  email?: string;
  pledgedAmount: number;
  currency: string;
  causeName?: string;
  status: 'pledged' | 'confirmed' | 'skipped';
  createdAt: string;
  confirmedAt?: string;
};

class AdminDonationService {
  async getCampaigns(): Promise<DonationCampaign[]> {
    const [legacyCampaignsSnap, challengesSnap, pledgesSnap, supportSnap] = await Promise.all([
      getDocs(collection(db, 'donationCampaigns')),
      getDocs(collection(db, 'challenges')),
      getDocs(collection(db, 'challengeContributionPledges')),
      getDocs(collection(db, 'supportDonations')),
    ]);

    const legacyCampaigns = legacyCampaignsSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? 'Untitled Campaign'),
        source: 'legacy' as const,
        currency: String(data.currency ?? 'KES'),
        goalAmount: Number(data.goalAmount ?? 0),
        confirmedAmount: Number(data.raisedAmount ?? 0),
        pendingAmount: 0,
        confirmedByCurrency: {},
        pendingByCurrency: {},
        raisedAmount: Number(data.raisedAmount ?? 0),
        contributorCount: Number(data.donorCount ?? 0),
        donorCount: Number(data.donorCount ?? 0),
        status: (data.status as CampaignStatus) ?? 'draft',
        startDate: String(data.startDate ?? ''),
        endDate: String(data.endDate ?? ''),
      };
    });

    // Build per-challenge pledge aggregates
    type PledgeStats = {
      confirmedAmount: number;
      pendingAmount: number;
      confirmedByCurrency: Record<string, number>;
      pendingByCurrency: Record<string, number>;
      confirmedDonors: Set<string>;
      allDonors: Set<string>;
      currency: string;
    };
    const pledgesByChallenge = new Map<string, PledgeStats>();
    pledgesSnap.docs.forEach((item) => {
      const data = item.data() as Record<string, unknown>;
      const challengeId = String(data.challengeId ?? '');
      const pledgedAmount = Number(data.pledgedAmount ?? data.amountKes ?? 0);
      const status = String(data.status ?? '');
      const userId = String(data.userId ?? '');
      const currency = String(data.currency ?? 'KES');
      if (!challengeId || status === 'skipped') return;
      const current: PledgeStats = pledgesByChallenge.get(challengeId) ?? {
        confirmedAmount: 0,
        pendingAmount: 0,
        confirmedByCurrency: {},
        pendingByCurrency: {},
        confirmedDonors: new Set(),
        allDonors: new Set(),
        currency,
      };
      current.allDonors.add(userId);
      if (status === 'confirmed') {
        current.confirmedAmount += pledgedAmount;
        current.confirmedByCurrency[currency] = (current.confirmedByCurrency[currency] ?? 0) + pledgedAmount;
        current.confirmedDonors.add(userId);
      } else if (status === 'pledged') {
        current.pendingAmount += pledgedAmount;
        current.pendingByCurrency[currency] = (current.pendingByCurrency[currency] ?? 0) + pledgedAmount;
      }
      pledgesByChallenge.set(challengeId, current);
    });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const challengeCampaigns = challengesSnap.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return { id: item.id, ...data } as Record<string, unknown> & { id: string };
      })
      .filter((row) => (row.donation as { enabled?: boolean } | undefined)?.enabled)
      .map((row) => {
        const donation = row.donation as Record<string, unknown> | undefined;
        const stats = pledgesByChallenge.get(String(row.id)) ?? {
          confirmedAmount: 0,
          pendingAmount: 0,
          confirmedByCurrency: {} as Record<string, number>,
          pendingByCurrency: {} as Record<string, number>,
          confirmedDonors: new Set<string>(),
          allDonors: new Set<string>(),
          currency: String(donation?.currency ?? 'KES'),
        };
        const moderationStatus = String(row.moderationStatus ?? '');
        const baseStatus = String(row.status ?? 'draft');
        const adminCampaignStatus = (donation?.campaignStatus as string | undefined);
        const timingEndDate = (donation?.contributionEndDate as string | undefined) ?? '';
        const isExpired = !!timingEndDate && timingEndDate < today;
        let status: CampaignStatus;
        if (adminCampaignStatus === 'paused') status = 'paused';
        else if (adminCampaignStatus === 'suspended') status = 'suspended';
        else if (adminCampaignStatus === 'completed' || isExpired) status = 'completed';
        else if (moderationStatus === 'pending') status = 'pending_approval';
        else if (baseStatus === 'active') status = 'active';
        else if (baseStatus === 'completed') status = 'completed';
        else status = 'draft';

        return {
          id: String(row.id),
          name: String((donation?.causeName as string | undefined) || row.name || 'Fitness + Cause Challenge'),
          source: 'challenge_cause' as const,
          currency: String(donation?.currency ?? stats.currency ?? 'KES'),
          goalAmount: Number(donation?.targetAmountKes ?? 0),
          confirmedAmount: stats.confirmedAmount,
          pendingAmount: stats.pendingAmount,
          confirmedByCurrency: stats.confirmedByCurrency,
          pendingByCurrency: stats.pendingByCurrency,
          raisedAmount: stats.confirmedAmount,
          contributorCount: stats.confirmedDonors.size,
          donorCount: stats.allDonors.size,
          status,
          campaignStatus: adminCampaignStatus as DonationCampaign['campaignStatus'],
          startDate: String(row.startDate ?? ''),
          endDate: String(row.endDate ?? ''),
          timingStartDate: (donation?.contributionStartDate as string | undefined) ?? undefined,
          timingEndDate: timingEndDate || undefined,
          challengeId: String(row.id),
          challengeName: String(row.name ?? ''),
          approvalStatus: String(donation?.approvalStatus ?? ''),
        };
      });

    // Virtual platform support campaign — per-currency breakdowns
    const supportDocs = supportSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const confirmedSupport = supportDocs.filter((d) => d.status === 'confirmed');
    const pendingSupport = supportDocs.filter((d) => d.status === 'intent' || d.status === 'pending_confirmation');
    const platformConfirmedByCurrency: Record<string, number> = {};
    const platformPendingByCurrency: Record<string, number> = {};
    confirmedSupport.forEach((d) => {
      const c = String(d.currency ?? 'KES');
      platformConfirmedByCurrency[c] = (platformConfirmedByCurrency[c] ?? 0) + Number(d.amountKes ?? 0);
    });
    pendingSupport.forEach((d) => {
      const c = String(d.currency ?? 'KES');
      platformPendingByCurrency[c] = (platformPendingByCurrency[c] ?? 0) + Number(d.amountKes ?? 0);
    });
    const platformCampaign: DonationCampaign = {
      id: 'tiizi_platform_support',
      name: 'Tiizi App Support',
      source: 'platform_support' as const,
      currency: 'mixed',
      goalAmount: 0,
      confirmedAmount: confirmedSupport.reduce((s, d) => s + Number(d.amountKes ?? 0), 0),
      pendingAmount: pendingSupport.reduce((s, d) => s + Number(d.amountKes ?? 0), 0),
      confirmedByCurrency: platformConfirmedByCurrency,
      pendingByCurrency: platformPendingByCurrency,
      raisedAmount: confirmedSupport.reduce((s, d) => s + Number(d.amountKes ?? 0), 0),
      contributorCount: new Set(confirmedSupport.map((d) => String(d.userId ?? ''))).size,
      donorCount: new Set(supportDocs.map((d) => String(d.userId ?? ''))).size,
      status: 'active',
      startDate: '',
      endDate: '',
    };

    return [platformCampaign, ...challengeCampaigns, ...legacyCampaigns]
      .sort((a, b) => {
        // Platform support first, then by start date
        if (a.source === 'platform_support' && b.source !== 'platform_support') return -1;
        if (b.source === 'platform_support' && a.source !== 'platform_support') return 1;
        return Date.parse(b.startDate || '') - Date.parse(a.startDate || '');
      });
  }

  async updateCampaignStatus(
    challengeId: string,
    campaignStatus: 'active' | 'paused' | 'suspended' | 'completed',
  ): Promise<void> {
    const ref = doc(db, 'challenges', challengeId);
    await updateDoc(ref, { 'donation.campaignStatus': campaignStatus });
  }

  async getUserDisplayMap(userIds: string[]): Promise<Map<string, { displayName: string; email: string }>> {
    const map = new Map<string, { displayName: string; email: string }>();
    if (!userIds.length) return map;
    const uniqueIds = [...new Set(userIds)];
    const snaps = await Promise.all(uniqueIds.map((uid) => getDoc(doc(db, 'users', uid))));
    snaps.forEach((snap, idx) => {
      const uid = uniqueIds[idx];
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const profile = data.profile as { displayName?: string; fullName?: string; email?: string } | undefined;
      const directName = typeof data.displayName === 'string' ? data.displayName : undefined;
      const directEmail = typeof data.email === 'string' ? data.email : undefined;
      map.set(uid, {
        displayName: profile?.displayName || profile?.fullName || directName || `User ${uid.slice(0, 6)}`,
        email: profile?.email || directEmail || '',
      });
    });
    return map;
  }

  async getChallengePledgesForAdmin(challengeId: string): Promise<AdminChallengePledge[]> {
    const snap = await getDocs(
      query(collection(db, 'challengeContributionPledges'), where('challengeId', '==', challengeId)),
    );
    const rawPledges = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        challengeId: String(data.challengeId ?? ''),
        userId: String(data.userId ?? ''),
        pledgedAmount: Number(data.pledgedAmount ?? data.amountKes ?? 0),
        currency: String(data.currency ?? 'KES'),
        causeName: data.causeName ? String(data.causeName) : undefined,
        status: (data.status as AdminChallengePledge['status']) ?? 'pledged',
        createdAt: String(data.createdAt ?? ''),
        confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
      };
    });
    const displayMap = await this.getUserDisplayMap(rawPledges.map((p) => p.userId));
    return rawPledges
      .map((p) => {
        const identity = displayMap.get(p.userId);
        return { ...p, displayName: identity?.displayName, email: identity?.email };
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async getPlatformSupportForDetail(): Promise<PlatformSupportDonation[]> {
    const snap = await getDocs(
      query(collection(db, 'supportDonations'), orderBy('createdAt', 'desc'), limit(200)),
    );
    const userIds = snap.docs.map((d) => String(d.data().userId ?? ''));
    const displayMap = await this.getUserDisplayMap(userIds);
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const uid = String(data.userId ?? '');
      const identity = displayMap.get(uid) ?? { displayName: `User ${uid.slice(0, 6)}`, email: '' };
      return {
        id: d.id,
        userId: uid,
        donorName: identity.displayName,
        donorEmail: identity.email || undefined,
        amountKes: Number(data.amountKes ?? 0),
        currency: data.currency ? String(data.currency) : undefined,
        frequency: String(data.frequency ?? 'one_time'),
        paymentMethod: String(data.paymentMethod ?? 'mobile_money'),
        status: (data.status as PlatformSupportDonation['status']) ?? 'intent',
        flagged: Boolean(data.flagged),
        transactionId: data.transactionId ? String(data.transactionId) : undefined,
        note: data.note ? String(data.note) : undefined,
        adminNote: data.adminNote ? String(data.adminNote) : undefined,
        confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
        createdAt: String(data.createdAt ?? ''),
      };
    });
  }

  async getTransactions(): Promise<DonationTransaction[]> {
    const [legacySnap, supportSnap, pledgesSnap] = await Promise.all([
      getDocs(collection(db, 'donationTransactions')),
      getDocs(collection(db, 'supportDonations')),
      getDocs(collection(db, 'challengeContributionPledges')),
    ]);

    const legacyTransactions: DonationTransaction[] = legacySnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        campaignId: String(data.campaignId ?? ''),
        campaignName: String(data.campaignName ?? 'Unknown campaign'),
        donorName: String(data.donorName ?? 'Anonymous'),
        donorEmail: String(data.donorEmail ?? ''),
        amount: Number(data.amount ?? 0),
        currency: String(data.currency ?? 'KES'),
        status: (data.status as DonationTransaction['status']) ?? 'pending',
        createdAt: String(data.createdAt ?? ''),
        source: 'legacy' as const,
      };
    });

    const supportTransactions: DonationTransaction[] = supportSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const isConfirmed = data.status === 'confirmed';
      return {
        id: d.id,
        campaignId: 'tiizi_platform_support',
        campaignName: 'Tiizi App Support',
        donorName: String(data.userId ?? 'Member'),
        donorEmail: '',
        amount: Number(data.amountKes ?? 0),
        currency: String(data.currency ?? 'KES'),
        status: isConfirmed ? ('confirmed_by_user' as const) : ('pending' as const),
        createdAt: String(data.createdAt ?? ''),
        source: 'platform_support' as const,
        transactionId: data.transactionId ? String(data.transactionId) : undefined,
        confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
      };
    });

    const pledgeTransactions: DonationTransaction[] = pledgesSnap.docs
      .flatMap((d) => {
        const data = d.data() as Record<string, unknown>;
        const status = String(data.status ?? '');
        if (status === 'skipped') return [];
        const txn: DonationTransaction = {
          id: d.id,
          campaignId: String(data.challengeId ?? ''),
          campaignName: String(data.causeName ?? 'Fitness + Cause Challenge'),
          causeName: data.causeName ? String(data.causeName) : undefined,
          donorName: String(data.userId ?? 'Member'),
          donorEmail: '',
          amount: Number(data.pledgedAmount ?? data.amountKes ?? 0),
          currency: String(data.currency ?? 'KES'),
          status: status === 'confirmed' ? ('confirmed_by_user' as const) : ('pledged' as const),
          createdAt: String(data.createdAt ?? ''),
          confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
          source: 'challenge_cause' as const,
        };
        return [txn];
      });

    return [...legacyTransactions, ...supportTransactions, ...pledgeTransactions]
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  }

  async getReports(): Promise<DonationReports> {
    const [campaigns, transactions] = await Promise.all([this.getCampaigns(), this.getTransactions()]);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const confirmedTxns = transactions.filter((t) => t.status === 'confirmed_by_user' || t.status === 'success');
    const totalDonationsAllTime = confirmedTxns.reduce((sum, row) => sum + row.amount, 0);
    const totalDonations30d = confirmedTxns
      .filter((t) => {
        const ts = Date.parse(t.createdAt);
        return !Number.isNaN(ts) && now - ts <= thirtyDaysMs;
      })
      .reduce((sum, row) => sum + row.amount, 0);
    const avgDonationAmount = confirmedTxns.length
      ? Number((totalDonationsAllTime / confirmedTxns.length).toFixed(2))
      : 0;
    const topCampaigns = [...campaigns]
      .sort((a, b) => b.confirmedAmount - a.confirmedAmount)
      .slice(0, 5)
      .map((campaign) => ({
        campaignId: campaign.id,
        name: campaign.name,
        raisedAmount: campaign.confirmedAmount,
        currency: campaign.currency,
      }));
    const bySource = confirmedTxns.reduce<Record<'platform_support' | 'challenge_cause' | 'legacy', number>>(
      (acc, row) => { acc[row.source] += row.amount; return acc; },
      { platform_support: 0, challenge_cause: 0, legacy: 0 },
    );

    return { totalDonationsAllTime, totalDonations30d, avgDonationAmount, topCampaigns, bySource };
  }

  async getPlatformSupportDonations(
    statusFilter: 'all' | PlatformSupportDonation['status'] | 'flagged',
    pageSize: number,
    cursor?: DocumentSnapshot,
  ): Promise<{ items: PlatformSupportDonation[]; nextCursor: DocumentSnapshot | null }> {
    const constraints = [
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1),
      ...(statusFilter !== 'all' && statusFilter !== 'flagged'
        ? [where('status', '==', statusFilter)]
        : []),
      ...(cursor ? [startAfter(cursor)] : []),
    ];
    const snap = await getDocs(query(collection(db, 'supportDonations'), ...constraints));
    let docs = snap.docs;
    const hasMore = docs.length > pageSize;
    if (hasMore) docs = docs.slice(0, pageSize);
    let items: PlatformSupportDonation[] = docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        userId: String(data.userId ?? ''),
        donorName: String(data.donorName ?? data.userId ?? 'Member'),
        donorEmail: data.donorEmail ? String(data.donorEmail) : undefined,
        amountKes: Number(data.amountKes ?? 0),
        currency: data.currency ? String(data.currency) : undefined,
        frequency: String(data.frequency ?? 'one_time'),
        paymentMethod: String(data.paymentMethod ?? 'mobile_money'),
        status: (data.status as PlatformSupportDonation['status']) ?? 'intent',
        flagged: Boolean(data.flagged),
        transactionId: data.transactionId ? String(data.transactionId) : undefined,
        note: data.note ? String(data.note) : undefined,
        adminNote: data.adminNote ? String(data.adminNote) : undefined,
        confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
        createdAt: String(data.createdAt ?? ''),
      };
    });
    if (statusFilter === 'flagged') items = items.filter((item) => item.flagged);
    return { items, nextCursor: hasMore ? docs[docs.length - 1] : null };
  }

  async getPlatformSupportReport(goalAmountKes: number): Promise<{
    totalConfirmedKes: number;
    pendingIntentKes: number;
    donorCount: number;
    goalProgressPct: number;
  }> {
    const snap = await getDocs(collection(db, 'supportDonations'));
    const donations = snap.docs.map((d) => d.data() as Record<string, unknown>);
    const confirmed = donations.filter((d) => d.status === 'confirmed');
    const pending = donations.filter((d) => d.status === 'intent' || d.status === 'pending_confirmation');
    const totalConfirmedKes = confirmed.reduce((sum, d) => sum + Number(d.amountKes ?? 0), 0);
    const pendingIntentKes = pending.reduce((sum, d) => sum + Number(d.amountKes ?? 0), 0);
    const donorCount = new Set(confirmed.map((d) => String(d.userId ?? ''))).size;
    const goalProgressPct = goalAmountKes > 0 ? Math.round((totalConfirmedKes / goalAmountKes) * 100) : 0;
    return { totalConfirmedKes, pendingIntentKes, donorCount, goalProgressPct };
  }

  async getPlatformSupportSettings(): Promise<SupportDonationSettings | null> {
    const snap = await getDoc(doc(db, 'platformSettings', 'support'));
    if (!snap.exists()) return null;
    return snap.data() as SupportDonationSettings;
  }

  async savePlatformSupportSettings(settings: SupportDonationSettings, _adminUid: string): Promise<void> {
    await setDoc(doc(db, 'platformSettings', 'support'), settings);
  }

  async updatePlatformSupportDonation(
    donationId: string,
    action: PlatformSupportAction,
    _adminUid: string,
    note: string,
  ): Promise<void> {
    const ref = doc(db, 'supportDonations', donationId);
    const updates: Record<string, unknown> = {};
    if (action === 'confirm') updates.status = 'confirmed';
    else if (action === 'reject') updates.status = 'rejected';
    else if (action === 'refund') updates.status = 'refunded';
    else if (action === 'flag') updates.flagged = true;
    else if (action === 'unflag') updates.flagged = false;
    if (note) updates.note = note;
    await updateDoc(ref, updates);
  }
}

export const adminDonationService = new AdminDonationService();
