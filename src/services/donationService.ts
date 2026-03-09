import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChallengeContributionPledge, SupportDonation, SupportDonationPreference } from '../types';

type CreateSupportDonationInput = {
  userId: string;
  amountKes: number;
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
  amountKes: number;
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
    const payload: ChallengeContributionPledge = {
      id: ref.id,
      challengeId: input.challengeId,
      groupId: input.groupId,
      userId: input.userId,
      amountKes: Math.max(0, Math.round(input.amountKes)),
      timingStartDate: input.timingStartDate,
      timingEndDate: input.timingEndDate,
      paymentPhoneNumber: input.paymentPhoneNumber,
      status: input.status,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, payload);
    return payload;
  }

  async getUserChallengeContribution(challengeId: string, userId: string): Promise<ChallengeContributionPledge | null> {
    const snap = await getDocs(
      query(
        collection(db, this.challengePledgesCollection),
        where('challengeId', '==', challengeId),
        where('userId', '==', userId),
      ),
    );
    if (snap.empty) return null;
    const records = snap.docs.map((item) => item.data() as ChallengeContributionPledge);
    records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return records[0] ?? null;
  }
}

export const donationService = new DonationService();
export type { CreateSupportDonationInput, CreateChallengeContributionInput };
