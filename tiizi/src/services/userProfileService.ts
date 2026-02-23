import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UserProfileSetup = {
  exerciseInterests: string[];
  customInterests: string[];
  primaryGoal?: string;
  secondaryGoal?: string;
  customGoals: string[];
  onboardingCompleted: boolean;
  region: string;
  personalInfo?: {
    fullName: string;
    email: string;
    phone: string;
    birthday?: string;
    weightKg?: number;
    heightCm?: number;
    displayName?: string;
  };
  privacySettings?: {
    isProfilePublic: boolean;
    showActivity: boolean;
    allowMessages: boolean;
    showWeightHeightToGroups?: boolean;
    showBirthdayToFriends?: boolean;
    isProfileSearchable?: boolean;
  };
};

class UserProfileService {
  private collectionName = 'users';

  async getProfileSetup(uid: string): Promise<UserProfileSetup | null> {
    const ref = doc(db, this.collectionName, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as { profile?: Partial<UserProfileSetup> };
    const profile = data.profile;
    if (!profile) return null;
    return {
      exerciseInterests: profile.exerciseInterests ?? [],
      customInterests: profile.customInterests ?? [],
      primaryGoal: profile.primaryGoal,
      secondaryGoal: profile.secondaryGoal,
      customGoals: profile.customGoals ?? [],
      onboardingCompleted: profile.onboardingCompleted ?? false,
      region: profile.region ?? 'Kenya',
      personalInfo: {
        fullName: profile.personalInfo?.fullName ?? '',
        email: profile.personalInfo?.email ?? '',
        phone: profile.personalInfo?.phone ?? '',
        birthday: profile.personalInfo?.birthday ?? '',
        weightKg: profile.personalInfo?.weightKg ?? undefined,
        heightCm: profile.personalInfo?.heightCm ?? undefined,
        displayName: profile.personalInfo?.displayName ?? '',
      },
      privacySettings: {
        isProfilePublic: profile.privacySettings?.isProfilePublic ?? true,
        showActivity: profile.privacySettings?.showActivity ?? true,
        allowMessages: profile.privacySettings?.allowMessages ?? true,
        showWeightHeightToGroups: profile.privacySettings?.showWeightHeightToGroups ?? true,
        showBirthdayToFriends: profile.privacySettings?.showBirthdayToFriends ?? true,
        isProfileSearchable: profile.privacySettings?.isProfileSearchable ?? true,
      },
    };
  }

  async upsertProfileSetup(uid: string, input: UserProfileSetup): Promise<void> {
    const ref = doc(db, this.collectionName, uid);
    await setDoc(
      ref,
      {
        profile: {
          exerciseInterests: input.exerciseInterests,
          customInterests: input.customInterests,
          primaryGoal: input.primaryGoal,
          secondaryGoal: input.secondaryGoal,
          customGoals: input.customGoals,
          onboardingCompleted: input.onboardingCompleted,
          region: input.region,
          personalInfo: {
            fullName: input.personalInfo?.fullName ?? '',
            email: input.personalInfo?.email ?? '',
            phone: input.personalInfo?.phone ?? '',
            birthday: input.personalInfo?.birthday ?? '',
            weightKg: input.personalInfo?.weightKg ?? null,
            heightCm: input.personalInfo?.heightCm ?? null,
            displayName: input.personalInfo?.displayName ?? '',
          },
          privacySettings: {
            isProfilePublic: input.privacySettings?.isProfilePublic ?? true,
            showActivity: input.privacySettings?.showActivity ?? true,
            allowMessages: input.privacySettings?.allowMessages ?? true,
            showWeightHeightToGroups: input.privacySettings?.showWeightHeightToGroups ?? true,
            showBirthdayToFriends: input.privacySettings?.showBirthdayToFriends ?? true,
            isProfileSearchable: input.privacySettings?.isProfileSearchable ?? true,
          },
        },
      },
      { merge: true },
    );
  }
}

export const userProfileService = new UserProfileService();
