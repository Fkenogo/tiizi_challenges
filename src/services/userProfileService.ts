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
    photoURL?: string;
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

  private removeUndefinedDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.removeUndefinedDeep(item));
    }

    if (value && typeof value === 'object') {
      const cleanedEntries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, this.removeUndefinedDeep(v)]);
      return Object.fromEntries(cleanedEntries);
    }

    return value;
  }

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
        photoURL: profile.personalInfo?.photoURL ?? '',
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

  async getUserIdentity(uid: string): Promise<{ displayName?: string; photoURL?: string } | null> {
    const ref = doc(db, this.collectionName, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as {
      displayName?: string;
      photoURL?: string;
      profile?: {
        personalInfo?: {
          displayName?: string;
          fullName?: string;
          photoURL?: string;
        };
      };
    };
    return {
      displayName:
        data.profile?.personalInfo?.displayName
        || data.profile?.personalInfo?.fullName
        || data.displayName
        || undefined,
      photoURL: data.profile?.personalInfo?.photoURL || data.photoURL || undefined,
    };
  }

  async upsertProfileSetup(uid: string, input: UserProfileSetup): Promise<void> {
    const ref = doc(db, this.collectionName, uid);
    const personalInfoPayload: Record<string, unknown> = {
      fullName: input.personalInfo?.fullName ?? '',
      email: input.personalInfo?.email ?? '',
      phone: input.personalInfo?.phone ?? '',
      birthday: input.personalInfo?.birthday ?? '',
      weightKg: input.personalInfo?.weightKg ?? null,
      heightCm: input.personalInfo?.heightCm ?? null,
      displayName: input.personalInfo?.displayName ?? '',
    };

    // Preserve existing profile photo unless caller explicitly sends one.
    if (input.personalInfo?.photoURL !== undefined) {
      personalInfoPayload.photoURL = input.personalInfo.photoURL;
    }

    const profilePayload: Record<string, unknown> = {
      exerciseInterests: input.exerciseInterests,
      customInterests: input.customInterests,
      customGoals: input.customGoals,
      onboardingCompleted: input.onboardingCompleted,
      region: input.region,
      personalInfo: personalInfoPayload,
      privacySettings: {
        isProfilePublic: input.privacySettings?.isProfilePublic ?? true,
        showActivity: input.privacySettings?.showActivity ?? true,
        allowMessages: input.privacySettings?.allowMessages ?? true,
        showWeightHeightToGroups: input.privacySettings?.showWeightHeightToGroups ?? true,
        showBirthdayToFriends: input.privacySettings?.showBirthdayToFriends ?? true,
        isProfileSearchable: input.privacySettings?.isProfileSearchable ?? true,
      },
    };

    if (input.primaryGoal) profilePayload.primaryGoal = input.primaryGoal;
    if (input.secondaryGoal) profilePayload.secondaryGoal = input.secondaryGoal;

    const rootPayload: Record<string, unknown> = { profile: profilePayload };
    if (input.personalInfo?.photoURL) {
      rootPayload.photoURL = input.personalInfo.photoURL;
    }

    const sanitizedRootPayload = this.removeUndefinedDeep(rootPayload) as Record<string, unknown>;

    await setDoc(
      ref,
      sanitizedRootPayload,
      { merge: true },
    );
  }
}

export const userProfileService = new UserProfileService();
