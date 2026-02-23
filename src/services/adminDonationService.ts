import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type DonationCampaign = {
  id: string;
  name: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  status: 'active' | 'draft' | 'completed';
  startDate: string;
  endDate: string;
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
};

export type DonationReports = {
  totalDonationsAllTime: number;
  totalDonations30d: number;
  avgDonationAmount: number;
  topCampaigns: Array<{ campaignId: string; name: string; raisedAmount: number }>;
};

class AdminDonationService {
  async getCampaigns(): Promise<DonationCampaign[]> {
    const snap = await getDocs(collection(db, 'donationCampaigns'));
    return snap.docs
      .map((d) => {
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
        };
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getTransactions(): Promise<DonationTransaction[]> {
    const snap = await getDocs(collection(db, 'donationTransactions'));
    return snap.docs
      .map((d) => {
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
        };
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async getReports(): Promise<DonationReports> {
    const [campaigns, transactions] = await Promise.all([this.getCampaigns(), this.getTransactions()]);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const successful = transactions.filter((t) => t.status === 'success');
    const totalDonationsAllTime = successful.reduce((sum, row) => sum + row.amount, 0);
    const totalDonations30d = successful
      .filter((t) => {
        const ts = Date.parse(t.createdAt);
        return !Number.isNaN(ts) && now - ts <= thirtyDaysMs;
      })
      .reduce((sum, row) => sum + row.amount, 0);
    const avgDonationAmount = successful.length ? Number((totalDonationsAllTime / successful.length).toFixed(2)) : 0;
    const topCampaigns = [...campaigns]
      .sort((a, b) => b.raisedAmount - a.raisedAmount)
      .slice(0, 5)
      .map((campaign) => ({ campaignId: campaign.id, name: campaign.name, raisedAmount: campaign.raisedAmount }));

    return {
      totalDonationsAllTime,
      totalDonations30d,
      avgDonationAmount,
      topCampaigns,
    };
  }
}

export const adminDonationService = new AdminDonationService();
