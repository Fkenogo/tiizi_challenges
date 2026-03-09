import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
}

export const adminDonationService = new AdminDonationService();
