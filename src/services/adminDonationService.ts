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

export type PlatformSupportDonation = {
  id: string;
  userId: string;
  donorName: string;
  donorEmail?: string;
  amountKes: number;
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
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  status: 'active' | 'draft' | 'completed' | 'pending_approval';
  startDate: string;
  endDate: string;
  source: 'platform' | 'challenge_cause';
};

export type DonationTransaction = {
  id: string;
  campaignId: string;
  campaignName: string;
  donorName: string;
  donorEmail: string;
  amount: number;
  currency: string;
  status: 'success' | 'pending' | 'failed' | 'refunded';
  createdAt: string;
  source: 'platform' | 'challenge_cause' | 'legacy';
  transactionId?: string;
  confirmedAt?: string;
};

export type DonationReports = {
  totalDonationsAllTime: number;
  totalDonations30d: number;
  avgDonationAmount: number;
  topCampaigns: Array<{ campaignId: string; name: string; raisedAmount: number }>;
  bySource: Record<'platform' | 'challenge_cause' | 'legacy', number>;
};

class AdminDonationService {
  async getCampaigns(): Promise<DonationCampaign[]> {
    const [legacyCampaignsSnap, challengesSnap, pledgesSnap] = await Promise.all([
      getDocs(collection(db, 'donationCampaigns')),
      getDocs(collection(db, 'challenges')),
      getDocs(collection(db, 'challengeContributionPledges')),
    ]);

    const legacyCampaigns = legacyCampaignsSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data.name ?? 'Untitled Campaign'),
          goalAmount: Number(data.goalAmount ?? 0),
          raisedAmount: Number(data.raisedAmount ?? 0),
          donorCount: Number(data.donorCount ?? 0),
          status: (data.status as DonationCampaign['status']) ?? 'draft',
          startDate: String(data.startDate ?? ''),
          endDate: String(data.endDate ?? ''),
          source: 'platform' as const,
        };
      });

    const pledgesByChallenge = new Map<string, { amount: number; donors: Set<string> }>();
    pledgesSnap.docs.forEach((item) => {
      const data = item.data() as Record<string, unknown>;
      const challengeId = String(data.challengeId ?? '');
      const amount = Number(data.amountKes ?? 0);
      const status = String(data.status ?? '');
      if (!challengeId || status !== 'pledged' || amount <= 0) return;
      const current = pledgesByChallenge.get(challengeId) ?? { amount: 0, donors: new Set<string>() };
      current.amount += amount;
      current.donors.add(String(data.userId ?? ''));
      pledgesByChallenge.set(challengeId, current);
    });

    const challengeCampaigns = challengesSnap.docs
      .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
      .map((item) => ({ id: item.id, ...item.data } as Record<string, unknown> & { id: string }))
      .filter((row) => (row.donation as { enabled?: boolean } | undefined)?.enabled)
      .map((row) => {
        const donation = row.donation as Record<string, unknown> | undefined;
        const pledgeStats = pledgesByChallenge.get(String(row.id)) ?? { amount: 0, donors: new Set<string>() };
        const moderationStatus = String(row.moderationStatus ?? '');
        const baseStatus = String(row.status ?? 'draft');
        const status: DonationCampaign['status'] =
          moderationStatus === 'pending'
            ? 'pending_approval'
            : (baseStatus === 'active' || baseStatus === 'completed' ? (baseStatus as 'active' | 'completed') : 'draft');
        return {
          id: String(row.id),
          name: String((donation?.causeName as string | undefined) || row.name || 'Fitness + Cause Challenge'),
          goalAmount: Number(donation?.targetAmountKes ?? 0),
          raisedAmount: pledgeStats.amount,
          donorCount: pledgeStats.donors.size,
          status,
          startDate: String(row.startDate ?? ''),
          endDate: String(row.endDate ?? ''),
          source: 'challenge_cause' as const,
        };
      });

    return [...challengeCampaigns, ...legacyCampaigns]
      .sort((a, b) => Date.parse(b.startDate || '') - Date.parse(a.startDate || ''));
  }

  async getTransactions(): Promise<DonationTransaction[]> {
    const [legacySnap, supportSnap, pledgesSnap] = await Promise.all([
      getDocs(collection(db, 'donationTransactions')),
      getDocs(collection(db, 'supportDonations')),
      getDocs(collection(db, 'challengeContributionPledges')),
    ]);

    const legacyTransactions = legacySnap.docs.map((d) => {
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
      return {
        id: d.id,
        campaignId: 'tiizi_platform_support',
        campaignName: 'Tiizi App Support',
        donorName: String(data.userId ?? 'Member'),
        donorEmail: '',
        amount: Number(data.amountKes ?? 0),
        currency: 'KES',
        status: data.status === 'confirmed' ? ('success' as const) : ('pending' as const),
        createdAt: String(data.createdAt ?? ''),
        source: 'platform' as const,
        transactionId: data.transactionId ? String(data.transactionId) : undefined,
        confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
      };
    });

    const pledgeTransactions = pledgesSnap.docs
      .map((d): DonationTransaction | null => {
        const data = d.data() as Record<string, unknown>;
        if (String(data.status ?? '') !== 'pledged') return null;
        return {
          id: d.id,
          campaignId: String(data.challengeId ?? ''),
          campaignName: 'Fitness + Cause Challenge',
          donorName: String(data.userId ?? 'Member'),
          donorEmail: '',
          amount: Number(data.amountKes ?? 0),
          currency: 'KES',
          status: 'pending' as const,
          createdAt: String(data.createdAt ?? ''),
          source: 'challenge_cause' as const,
        };
      })
      .filter((item): item is DonationTransaction => item !== null);

    return [...legacyTransactions, ...supportTransactions, ...pledgeTransactions]
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  }

  async getReports(): Promise<DonationReports> {
    const [campaigns, transactions] = await Promise.all([this.getCampaigns(), this.getTransactions()]);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const counted = transactions.filter((t) => t.status === 'success' || t.status === 'pending');
    const totalDonationsAllTime = counted.reduce((sum, row) => sum + row.amount, 0);
    const totalDonations30d = counted
      .filter((t) => {
        const ts = Date.parse(t.createdAt);
        return !Number.isNaN(ts) && now - ts <= thirtyDaysMs;
      })
      .reduce((sum, row) => sum + row.amount, 0);
    const avgDonationAmount = counted.length ? Number((totalDonationsAllTime / counted.length).toFixed(2)) : 0;
    const topCampaigns = [...campaigns]
      .sort((a, b) => b.raisedAmount - a.raisedAmount)
      .slice(0, 5)
      .map((campaign) => ({ campaignId: campaign.id, name: campaign.name, raisedAmount: campaign.raisedAmount }));
    const bySource = counted.reduce<Record<'platform' | 'challenge_cause' | 'legacy', number>>(
      (acc, row) => {
        acc[row.source] += row.amount;
        return acc;
      },
      { platform: 0, challenge_cause: 0, legacy: 0 },
    );

    return {
      totalDonationsAllTime,
      totalDonations30d,
      avgDonationAmount,
      topCampaigns,
      bySource,
    };
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
    return {
      items,
      nextCursor: hasMore ? docs[docs.length - 1] : null,
    };
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
