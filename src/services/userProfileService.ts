import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UserProfileSetup = {
  exerciseInterests: string[];
  wellnessInterests: string[];
  customInterests: string[];
  /** Custom "Other wellness topic" text, mirroring customInterests (exercise) and customGoals (goals). */
  customWellnessInterests: string[];
  goals: string[];
  primaryGoal?: string;
  secondaryGoal?: string;
  customGoals: string[];
  onboardingCompleted: boolean;
  hasSeenIntro: boolean;
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
    gender?: string;
    genderSelfDescribe?: string;
  };
  privacySettings?: {
    isProfilePublic: boolean;
    showActivity: boolean;
    allowMessages: boolean;
    showWeightHeightToGroups?: boolean;
    showBirthdayToFriends?: boolean;
    isProfileSearchable?: boolean;
  };
  /**
   * True only once the user has explicitly gone through the privacy-settings
   * onboarding step (step 5) and pressed Continue there. Distinct from
   * `privacySettings` itself, which every earlier onboarding step also writes
   * with default values — so `privacySettings` existing can't be used to
   * tell whether step 5 was actually reached.
   */
  privacySettingsCompleted?: boolean;
  /**
   * True once the user has passed through the wellness-topics onboarding
   * step (step 3) via Next or Skip. Wellness topics are optional, so an
   * empty `wellnessInterests` array is a valid, completed state — it can't
   * be used on its own to tell whether step 3 was ever reached.
   */
  wellnessInterestsCompleted?: boolean;
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
    // goals[]: read stored array; fall back to primaryGoal/secondaryGoal for old records
    const storedGoals = (profile as unknown as { goals?: string[] }).goals;
    const derivedGoals = storedGoals?.length
      ? storedGoals
      : [profile.primaryGoal, profile.secondaryGoal].filter(Boolean) as string[];

    return {
      exerciseInterests: profile.exerciseInterests ?? [],
      wellnessInterests: (profile as unknown as { wellnessInterests?: string[] }).wellnessInterests ?? [],
      customInterests: profile.customInterests ?? [],
      customWellnessInterests: (profile as unknown as { customWellnessInterests?: string[] }).customWellnessInterests ?? [],
      goals: derivedGoals,
      primaryGoal: profile.primaryGoal,
      secondaryGoal: profile.secondaryGoal,
      customGoals: profile.customGoals ?? [],
      onboardingCompleted: profile.onboardingCompleted ?? false,
      hasSeenIntro: (profile as unknown as { hasSeenIntro?: boolean }).hasSeenIntro ?? false,
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
        gender: (profile.personalInfo as { gender?: string })?.gender ?? undefined,
        genderSelfDescribe: (profile.personalInfo as { genderSelfDescribe?: string })?.genderSelfDescribe ?? undefined,
      },
      privacySettings: {
        isProfilePublic: profile.privacySettings?.isProfilePublic ?? true,
        showActivity: profile.privacySettings?.showActivity ?? true,
        allowMessages: profile.privacySettings?.allowMessages ?? true,
        showWeightHeightToGroups: profile.privacySettings?.showWeightHeightToGroups ?? true,
        showBirthdayToFriends: profile.privacySettings?.showBirthdayToFriends ?? true,
        isProfileSearchable: profile.privacySettings?.isProfileSearchable ?? true,
      },
      privacySettingsCompleted: (profile as unknown as { privacySettingsCompleted?: boolean }).privacySettingsCompleted ?? false,
      wellnessInterestsCompleted: (profile as unknown as { wellnessInterestsCompleted?: boolean }).wellnessInterestsCompleted ?? false,
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
      gender: input.personalInfo?.gender ?? null,
      genderSelfDescribe: input.personalInfo?.genderSelfDescribe ?? null,
    };

    // Preserve existing profile photo unless caller explicitly sends one.
    if (input.personalInfo?.photoURL !== undefined) {
      personalInfoPayload.photoURL = input.personalInfo.photoURL;
    }

    const profilePayload: Record<string, unknown> = {
      exerciseInterests: input.exerciseInterests,
      wellnessInterests: input.wellnessInterests,
      customInterests: input.customInterests,
      customWellnessInterests: input.customWellnessInterests,
      goals: input.goals,
      customGoals: input.customGoals,
      onboardingCompleted: input.onboardingCompleted,
      hasSeenIntro: input.hasSeenIntro,
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

    // Only the privacy-settings onboarding step (step 5) sets this explicitly.
    // Omit it otherwise so `{ merge: true }` preserves whatever value is
    // already on the document instead of clobbering it back to undefined.
    if (input.privacySettingsCompleted !== undefined) {
      profilePayload.privacySettingsCompleted = input.privacySettingsCompleted;
    }
    // Only the wellness-topics onboarding step (step 3) sets this explicitly,
    // same reasoning as privacySettingsCompleted above.
    if (input.wellnessInterestsCompleted !== undefined) {
      profilePayload.wellnessInterestsCompleted = input.wellnessInterestsCompleted;
    }

    // Derive backwards-compat scalar fields from goals[]
    const primaryGoal = input.goals[0] || input.primaryGoal || '';
    const secondaryGoal = input.goals[1] || input.secondaryGoal || '';
    if (primaryGoal) profilePayload.primaryGoal = primaryGoal;
    if (secondaryGoal) profilePayload.secondaryGoal = secondaryGoal;

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
