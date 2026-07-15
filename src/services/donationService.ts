import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChallengeContributionPledge, SupportDonation, SupportDonationPreference } from '../types';

type CreateSupportDonationInput = {
  userId: string;
  amountKes: number;
  currency?: string;
  frequency: SupportDonation['frequency'];
  trigger: SupportDonation['trigger'];
  paymentMethod: SupportDonation['paymentMethod'];
  paymentDestination: SupportDonation['paymentDestination'];
  ussdCode?: string;
  challengeId?: string;
};

type CreateChallengeContributionInput = {
  challengeId: string;
  groupId: string;
  userId: string;
  pledgedAmount: number;
  currency?: string;
  causeName?: string;
  timingStartDate?: string;
  timingEndDate?: string;
  paymentPhoneNumber?: string;
  status: 'pledged' | 'skipped';
};

class DonationService {
  private supportCollection = 'supportDonations';
  private supportPrefsCollection = 'supportDonationPreferences';
  private challengePledgesCollection = 'challengeContributionPledges';

  async createSupportDonation(input: CreateSupportDonationInput): Promise<SupportDonation> {
    const ref = doc(collection(db, this.supportCollection));
    const payload: SupportDonation = {
      id: ref.id,
      userId: input.userId,
      amountKes: Math.max(0, Math.round(input.amountKes)),
      currency: input.currency,
      frequency: input.frequency,
      trigger: input.trigger,
      paymentMethod: input.paymentMethod,
      paymentDestination: input.paymentDestination,
      ussdCode: input.ussdCode,
      challengeId: input.challengeId,
      status: 'intent',
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, payload);
    return payload;
  }

  async confirmSupportDonation(input: {
    donationId: string;
    userId: string;
    transactionId?: string;
  }): Promise<void> {
    const ref = doc(db, this.supportCollection, input.donationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Donation record not found');
    const existing = snap.data() as SupportDonation;
    if (existing.userId !== input.userId) throw new Error('Not allowed to confirm this donation');

    await setDoc(
      ref,
      {
        status: 'confirmed',
        transactionId: input.transactionId?.trim() || undefined,
        confirmedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async saveSupportPreference(input: {
    userId: string;
    preferredFrequency: SupportDonationPreference['preferredFrequency'];
    preferredTrigger: SupportDonationPreference['preferredTrigger'];
  }): Promise<void> {
    const ref = doc(db, this.supportPrefsCollection, input.userId);
    await setDoc(ref, {
      userId: input.userId,
      preferredFrequency: input.preferredFrequency,
      preferredTrigger: input.preferredTrigger,
      updatedAt: new Date().toISOString(),
    } satisfies SupportDonationPreference, { merge: true });
  }

  async getSupportPreference(userId: string): Promise<SupportDonationPreference | null> {
    const snap = await getDoc(doc(db, this.supportPrefsCollection, userId));
    if (!snap.exists()) return null;
    return snap.data() as SupportDonationPreference;
  }

  async getUserSupportDonations(userId: string): Promise<SupportDonation[]> {
    const snap = await getDocs(query(collection(db, this.supportCollection), where('userId', '==', userId)));
    return snap.docs
      .map((item) => item.data() as SupportDonation)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async createChallengeContribution(input: CreateChallengeContributionInput): Promise<ChallengeContributionPledge> {
    const ref = doc(collection(db, this.challengePledgesCollection));
    const now = new Date().toISOString();
    const payload: ChallengeContributionPledge = {
      id: ref.id,
      challengeId: input.challengeId,
      groupId: input.groupId,
      userId: input.userId,
      pledgedAmount: Math.max(0, Math.round(input.pledgedAmount)),
      amountKes: Math.max(0, Math.round(input.pledgedAmount)),
      currency: input.currency,
      causeName: input.causeName,
      timingStartDate: input.timingStartDate,
      timingEndDate: input.timingEndDate,
      paymentPhoneNumber: input.paymentPhoneNumber,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, payload);
    return payload;
  }

  async confirmChallengeContribution(pledgeId: string, userId: string): Promise<void> {
    const ref = doc(db, this.challengePledgesCollection, pledgeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Pledge record not found');
    const existing = snap.data() as ChallengeContributionPledge;
    if (existing.userId !== userId) throw new Error('Not allowed to confirm this pledge');
    const now = new Date().toISOString();
    await setDoc(ref, { status: 'confirmed', confirmedAt: now, updatedAt: now }, { merge: true });
  }

  async getUserChallengeContributions(challengeId: string, userId: string): Promise<ChallengeContributionPledge[]> {
    const snap = await getDocs(
      query(
        collection(db, this.challengePledgesCollection),
        where('challengeId', '==', challengeId),
        where('userId', '==', userId),
      ),
    );
    const records = snap.docs.map((item) => item.data() as ChallengeContributionPledge);
    records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return records;
  }

  async getChallengeTotalRaised(challengeId: string): Promise<number> {
    const snap = await getDocs(
      query(collection(db, this.challengePledgesCollection), where('challengeId', '==', challengeId)),
    );
    return snap.docs.reduce((sum, d) => {
      const p = d.data() as ChallengeContributionPledge;
      return p.status === 'confirmed' ? sum + (p.pledgedAmount ?? p.amountKes ?? 0) : sum;
    }, 0);
  }
}

export const donationService = new DonationService();
export type { CreateSupportDonationInput, CreateChallengeContributionInput };
