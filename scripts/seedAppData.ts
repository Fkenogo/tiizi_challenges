import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import catalogExercisesSource from '../catalogExercises_CLEAN.json';

const requiredEnvKeys = ['VITE_FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'] as const;
for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID as string;
const seedTag = process.env.SEED_TAG ?? 'tiizi_seed_v1';
const primaryUid = process.env.SEED_PRIMARY_UID?.trim() || '';
const primaryEmail = process.env.SEED_PRIMARY_EMAIL?.trim() || '';
const now = Date.now();

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

type SeedUser = {
  id: string;
  displayName: string;
  email: string;
  role?: 'member' | 'admin' | 'moderator' | 'support' | 'content_manager' | 'super_admin';
  accountStatus: 'active' | 'suspended';
  createdAt: string;
  lastActiveAt?: string;
  profile: {
    email: string;
    fullName: string;
    birthday?: string;
    region: string;
    role?: string;
    onboardingCompleted: boolean;
    exerciseInterests: string[];
    customInterests: string[];
    primaryGoal: string;
    secondaryGoal: string;
    customGoals: string[];
    privacySettings: {
      allowMessages: boolean;
      isProfilePublic: boolean;
      showActivity: boolean;
    };
  };
  seedTag: string;
};

type SeedGroup = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  coverImageUrl: string;
  isPrivate: boolean;
  requireAdminApproval: boolean;
  allowMemberChallenges: boolean;
  inviteCode: string;
  activeChallenges: number;
  moderationStatus: 'active' | 'flagged' | 'deactivated';
  isFeatured: boolean;
  seedTag: string;
};

type SeedMembership = {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'joined' | 'pending' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  seedTag: string;
};

type SeedChallenge = {
  id: string;
  name: string;
  description: string;
  groupId: string;
  exerciseIds: string[];
  challengeType: 'collective' | 'competitive' | 'streak';
  type: 'collective' | 'competitive' | 'streak';
  coverImageUrl: string;
  activities: Array<{
    exerciseId: string;
    exerciseName: string;
    targetValue: number;
    unit: string;
  }>;
  donation?: {
    enabled: boolean;
    causeDescription?: string;
    targetAmount?: number;
  };
  startDate: string;
  endDate: string;
  createdBy: string;
  status: 'draft' | 'active' | 'completed';
  moderationStatus: 'pending' | 'approved' | 'needs_changes';
  participantCount: number;
  progress: number;
  createdAt: string;
  seedTag: string;
};

type SeedWorkout = {
  id: string;
  userId: string;
  challengeId: string;
  exerciseId: string;
  value: number;
  unit: string;
  groupId: string;
  completedAt: string;
  notes?: string;
  seedTag: string;
};

type ExerciseLite = {
  id: string;
  name: string;
  unit: string;
};

type CatalogExerciseDocument = {
  id: string;
  name?: string;
  metric?: {
    unit?: string;
  };
} & Record<string, unknown>;

const exerciseInterests = [
  ['running', 'Running', '🏃'],
  ['walking', 'Walking', '🚶'],
  ['gym-weightlifting', 'Gym/Weightlifting', '💪'],
  ['home-workouts', 'Home Workouts', '🏠'],
  ['yoga', 'Yoga', '🧘'],
  ['swimming', 'Swimming', '🏊'],
  ['cycling', 'Cycling', '🚴'],
  ['football', 'Football (Soccer)', '⚽'],
  ['hiking', 'Hiking', '⛰️'],
  ['group-fitness', 'Group Fitness Classes', '👥'],
  ['hiit', 'HIIT/Circuit Training', '⚡'],
  ['pilates', 'Pilates', '🤸'],
  ['dancing', 'Dancing', '💃'],
  ['stretching', 'Stretching/Mobility', '🙆'],
  ['other', 'Other', '✍️'],
] as const;

const wellnessGoals = [
  ['weight-loss', 'Weight Loss', 'Lose excess weight and burn fat', '⚖️'],
  ['stay-healthy', 'Stay Healthy & Active', 'Maintain overall health', '❤️'],
  ['build-strength', 'Build Strength', 'Get stronger and build muscle', '💪'],
  ['improve-fitness', 'Improve Fitness', 'Increase stamina and endurance', '🏃'],
  ['manage-health', 'Manage Health Condition', 'Support blood pressure, diabetes, and heart health', '🩺'],
  ['reduce-stress', 'Reduce Stress', 'Improve mental wellbeing and relaxation', '🧘'],
  ['increase-energy', 'Increase Energy', 'Combat fatigue and boost energy levels', '⚡'],
  ['improve-flexibility', 'Improve Flexibility', 'Improve mobility and movement', '🤸'],
  ['build-routine', 'Build Daily Routine', 'Create healthy and consistent habits', '📅'],
  ['feel-confident', 'Feel More Confident', 'Boost confidence and self-esteem', '✨'],
  ['stay-accountable', 'Stay Accountable', 'Get support and consistency from the group', '👥'],
  ['other', 'Other', 'Custom wellness goal', '✍️'],
] as const;

function isoDaysAgo(days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function deleteSeededDocs(collectionName: string) {
  const q = db.collection(collectionName).where('seedTag', '==', seedTag);
  const snap = await q.get();
  if (snap.empty) return 0;

  for (const docs of chunk(snap.docs, 400)) {
    const batch = db.batch();
    docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return snap.size;
}

async function setDocs<T extends { id: string }>(collectionName: string, docs: T[]) {
  for (const docsChunk of chunk(docs, 400)) {
    const batch = db.batch();
    docsChunk.forEach((item) => {
      const ref = db.collection(collectionName).doc(item.id);
      batch.set(ref, item);
    });
    await batch.commit();
  }
}

async function getExercisePool(): Promise<ExerciseLite[]> {
  const exerciseSnap = await db.collection('catalogExercises').limit(200).get();
  if (exerciseSnap.empty) {
    return [
      { id: 'pushups', name: 'Pushups', unit: 'reps' },
      { id: 'squats', name: 'Squats', unit: 'reps' },
      { id: 'running', name: 'Running', unit: 'minutes' },
      { id: 'plank', name: 'Plank', unit: 'seconds' },
      { id: 'burpees', name: 'Burpees', unit: 'reps' },
      { id: 'lunges', name: 'Lunges', unit: 'reps' },
    ];
  }

  return exerciseSnap.docs.slice(0, 60).map((item: QueryDocumentSnapshot) => {
    const data = item.data() as Record<string, unknown>;
    const metric = (data.metric as { unit?: string } | undefined)?.unit;
    return {
      id: item.id,
      name: String(data.name ?? item.id),
      unit: typeof metric === 'string' && metric.length > 0 ? metric : 'reps',
    };
  });
}

async function ensureCatalogExercisesLoaded() {
  const existing = await db.collection('catalogExercises').limit(1).get();
  if (!existing.empty) return;

  const source = (catalogExercisesSource as { documents?: CatalogExerciseDocument[] }).documents ?? [];
  if (source.length === 0) {
    console.warn('catalogExercises_CLEAN.json has no documents. Skipping catalog seed.');
    return;
  }

  console.log(`Catalog empty. Loading ${source.length} catalogExercises docs...`);
  for (const docsChunk of chunk(source, 350)) {
    const batch = db.batch();
    docsChunk.forEach((exercise) => {
      const ref = db.collection('catalogExercises').doc(exercise.id);
      batch.set(ref, exercise);
    });
    await batch.commit();
  }
}

function buildUsers(): SeedUser[] {
  const firstNames = [
    'Alex',
    'Sarah',
    'Mike',
    'Njeri',
    'Amina',
    'Kevin',
    'Ruth',
    'David',
    'Lisa',
    'Jordan',
    'Priya',
    'Sophie',
    'Marcus',
    'Elena',
    'James',
    'Wanjiku',
    'Faith',
    'Brian',
    'Grace',
    'Diana',
    'Sam',
    'Peter',
    'Zuri',
    'Kelvin',
  ];
  const lastNames = [
    'Rivera',
    'Chen',
    'Kamau',
    'Otieno',
    'Patel',
    'Johnson',
    'Wangari',
    'Mutua',
    'Njeri',
    'Mwangi',
    'Achieng',
    'Okoth',
  ];

  const users: SeedUser[] = [];
  for (let i = 0; i < 24; i += 1) {
    const first = firstNames[i];
    const last = lastNames[i % lastNames.length];
    const displayName = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@tiizi.test`;
    const createdAt = isoDaysAgo(120 - i * 4);
    const primaryGoal = pick(wellnessGoals.map((goal) => goal[0]), i);
    const secondaryGoal = pick(wellnessGoals.map((goal) => goal[0]), i + 3);
    const interests = [
      pick(exerciseInterests.map((entry) => entry[0]), i),
      pick(exerciseInterests.map((entry) => entry[0]), i + 5),
    ];

    users.push({
      id: `seed_user_${String(i + 1).padStart(2, '0')}`,
      displayName,
      email,
      role: i === 0 ? 'admin' : i === 1 ? 'moderator' : 'member',
      accountStatus: i === 19 ? 'suspended' : 'active',
      createdAt,
      lastActiveAt: isoDaysAgo(i % 10),
      profile: {
        email,
        fullName: displayName,
        birthday: `198${i % 10}-0${(i % 8) + 1}-1${i % 9}`,
        region: 'Kenya',
        onboardingCompleted: true,
        exerciseInterests: interests,
        customInterests: i % 6 === 0 ? ['Weekend trail runs'] : [],
        primaryGoal,
        secondaryGoal,
        customGoals: i % 5 === 0 ? ['Prepare for city marathon'] : [],
        privacySettings: {
          allowMessages: true,
          isProfilePublic: i % 4 !== 0,
          showActivity: true,
        },
      },
      seedTag,
    });
  }

  if (primaryUid) {
    const existingIndex = users.findIndex((u) => u.id === primaryUid);
    const primaryUser: SeedUser = {
      id: primaryUid,
      displayName: 'Primary Test User',
      email: primaryEmail || 'primary.user@tiizi.test',
      role: 'admin',
      accountStatus: 'active',
      createdAt: isoDaysAgo(10),
      lastActiveAt: isoDaysAgo(0),
      profile: {
        email: primaryEmail || 'primary.user@tiizi.test',
        fullName: 'Primary Test User',
        birthday: '1990-04-12',
        region: 'Kenya',
        role: 'admin',
        onboardingCompleted: true,
        exerciseInterests: ['running', 'yoga', 'group-fitness'],
        customInterests: [],
        primaryGoal: 'stay-accountable',
        secondaryGoal: 'improve-fitness',
        customGoals: [],
        privacySettings: {
          allowMessages: true,
          isProfilePublic: true,
          showActivity: true,
        },
      },
      seedTag,
    };
    if (existingIndex >= 0) users[existingIndex] = primaryUser;
    else users.unshift(primaryUser);
  }

  return users;
}

function buildGroups(users: SeedUser[]): SeedGroup[] {
  const owners = users.slice(0, 8);
  return [
    {
      id: 'seed_group_early_birds',
      name: 'Early Birds Kenya',
      description: 'Morning consistency group for accountability and fitness streaks.',
      ownerId: owners[0].id,
      memberCount: 0,
      createdAt: isoDaysAgo(80),
      coverImageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
      isPrivate: false,
      requireAdminApproval: false,
      allowMemberChallenges: true,
      inviteCode: 'EARLY-BIRDS',
      activeChallenges: 2,
      moderationStatus: 'active',
      isFeatured: true,
      seedTag,
    },
    {
      id: 'seed_group_zen_yoga',
      name: 'Zen Yoga Community',
      description: 'Daily flow, mindfulness, and streak-based group yoga sessions.',
      ownerId: owners[1].id,
      memberCount: 0,
      createdAt: isoDaysAgo(74),
      coverImageUrl: 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80',
      isPrivate: true,
      requireAdminApproval: true,
      allowMemberChallenges: true,
      inviteCode: 'ZEN-YOGA',
      activeChallenges: 1,
      moderationStatus: 'active',
      isFeatured: true,
      seedTag,
    },
    {
      id: 'seed_group_strength_club',
      name: 'Strength Club',
      description: 'Progressive strength programs for all levels with weekly check-ins.',
      ownerId: owners[2].id,
      memberCount: 0,
      createdAt: isoDaysAgo(62),
      coverImageUrl: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=80',
      isPrivate: false,
      requireAdminApproval: false,
      allowMemberChallenges: true,
      inviteCode: 'STRONG-CLUB',
      activeChallenges: 2,
      moderationStatus: 'active',
      isFeatured: false,
      seedTag,
    },
    {
      id: 'seed_group_squad_254',
      name: 'Squad 254',
      description: 'Collective rep-based challenges for team momentum.',
      ownerId: owners[3].id,
      memberCount: 0,
      createdAt: isoDaysAgo(54),
      coverImageUrl: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?auto=format&fit=crop&w=1200&q=80',
      isPrivate: false,
      requireAdminApproval: false,
      allowMemberChallenges: true,
      inviteCode: 'SQUAD-254',
      activeChallenges: 2,
      moderationStatus: 'active',
      isFeatured: true,
      seedTag,
    },
    {
      id: 'seed_group_trail_seekers',
      name: 'Trail Seekers',
      description: 'Outdoor runs, hikes, and weekly distance goals.',
      ownerId: owners[4].id,
      memberCount: 0,
      createdAt: isoDaysAgo(40),
      coverImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
      isPrivate: true,
      requireAdminApproval: true,
      allowMemberChallenges: false,
      inviteCode: 'TRAIL-TEAM',
      activeChallenges: 1,
      moderationStatus: 'active',
      isFeatured: false,
      seedTag,
    },
    {
      id: 'seed_group_hydration_crew',
      name: 'Hydration Crew',
      description: 'Daily hydration and wellness tracking accountability group.',
      ownerId: owners[5].id,
      memberCount: 0,
      createdAt: isoDaysAgo(28),
      coverImageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1200&q=80',
      isPrivate: false,
      requireAdminApproval: false,
      allowMemberChallenges: true,
      inviteCode: 'HYDRATE-NOW',
      activeChallenges: 1,
      moderationStatus: 'active',
      isFeatured: false,
      seedTag,
    },
  ];
}

function buildMemberships(groups: SeedGroup[], users: SeedUser[]): SeedMembership[] {
  const memberships: SeedMembership[] = [];
  const joinedUsers = users.filter((u) => u.accountStatus === 'active');

  groups.forEach((group, gIndex) => {
    const groupUsers = joinedUsers.filter((_, idx) => (idx + gIndex) % 2 === 0).slice(0, 12);
    const ownerIncluded = new Set<string>([group.ownerId, ...groupUsers.map((u) => u.id)]);
    const allForGroup = users.filter((u) => ownerIncluded.has(u.id));

    allForGroup.forEach((user, uIndex) => {
      memberships.push({
        id: `${group.id}_${user.id}`,
        groupId: group.id,
        userId: user.id,
        role: user.id === group.ownerId ? 'owner' : uIndex % 5 === 0 ? 'admin' : 'member',
        status: 'joined',
        createdAt: isoDaysAgo(70 - (uIndex + gIndex) * 2),
        approvedAt: isoDaysAgo(68 - (uIndex + gIndex) * 2),
        seedTag,
      });
    });

    if (group.isPrivate || group.requireAdminApproval) {
      const pending = users
        .filter((user, idx) => (idx + gIndex) % 7 === 0 && !ownerIncluded.has(user.id))
        .slice(0, 3);
      pending.forEach((user, idx) => {
        memberships.push({
          id: `${group.id}_${user.id}`,
          groupId: group.id,
          userId: user.id,
          role: 'member',
          status: idx === 2 ? 'rejected' : 'pending',
          createdAt: isoDaysAgo(3 + idx),
          approvedAt: idx === 2 ? isoDaysAgo(1) : undefined,
          seedTag,
        });
      });
    }
  });

  if (primaryUid) {
    const targetGroups = ['seed_group_early_birds', 'seed_group_strength_club', 'seed_group_hydration_crew'];
    targetGroups.forEach((groupId, idx) => {
      memberships.push({
        id: `${groupId}_${primaryUid}`,
        groupId,
        userId: primaryUid,
        role: idx === 0 ? 'admin' : 'member',
        status: 'joined',
        createdAt: isoDaysAgo(6 - idx),
        approvedAt: isoDaysAgo(6 - idx),
        seedTag,
      });
    });
  }

  return memberships;
}

function buildChallenges(
  groups: SeedGroup[],
  memberships: SeedMembership[],
  exercisePool: ExerciseLite[],
): SeedChallenge[] {
  const joinedByGroup = new Map<string, SeedMembership[]>();
  memberships
    .filter((membership) => membership.status === 'joined')
    .forEach((membership) => {
      const list = joinedByGroup.get(membership.groupId) ?? [];
      list.push(membership);
      joinedByGroup.set(membership.groupId, list);
    });

  const templates = [
    { title: '30-Day Core Blast', type: 'collective' as const, status: 'active' as const, days: 30 },
    { title: 'Pushup Duel', type: 'competitive' as const, status: 'active' as const, days: 21 },
    { title: 'Morning Streak', type: 'streak' as const, status: 'completed' as const, days: 14 },
  ];

  const challenges: SeedChallenge[] = [];
  groups.forEach((group, gIndex) => {
    templates.forEach((template, tIndex) => {
      const challengeIndex = gIndex * templates.length + tIndex + 1;
      const activityBase = (gIndex + 1) * (tIndex + 2);
      const e1 = pick(exercisePool, challengeIndex * 2);
      const e2 = pick(exercisePool, challengeIndex * 2 + 1);
      const startOffset = 40 - challengeIndex * 2;
      const startDate = isoDaysAgo(Math.max(startOffset, 2));
      const endDate = new Date(Date.parse(startDate) + template.days * 24 * 60 * 60 * 1000).toISOString();
      const creator = joinedByGroup.get(group.id)?.[tIndex % (joinedByGroup.get(group.id)?.length || 1)]?.userId || group.ownerId;
      const participantCount = Math.max((joinedByGroup.get(group.id)?.length || 6) - tIndex, 4);
      const progress =
        template.status === 'completed'
          ? 100
          : template.status === 'active'
            ? Math.min(35 + (challengeIndex % 5) * 12, 92)
            : 0;

      challenges.push({
        id: `seed_challenge_${String(challengeIndex).padStart(2, '0')}`,
        name: `${group.name.split(' ')[0]} ${template.title}`,
        description: `${template.title} for ${group.name}. Built for group-first accountability and shared progress.`,
        groupId: group.id,
        exerciseIds: [e1.id, e2.id],
        challengeType: template.type,
        type: template.type,
        coverImageUrl: group.coverImageUrl,
        activities: [
          {
            exerciseId: e1.id,
            exerciseName: e1.name,
            targetValue: 80 + activityBase * 5,
            unit: e1.unit,
          },
          {
            exerciseId: e2.id,
            exerciseName: e2.name,
            targetValue: 45 + activityBase * 3,
            unit: e2.unit,
          },
        ],
        donation:
          template.type === 'collective'
            ? {
                enabled: true,
                causeDescription: 'Community clean water initiative',
                targetAmount: 50000 + challengeIndex * 4000,
              }
            : { enabled: false },
        startDate,
        endDate,
        createdBy: creator,
        status:
          tIndex === 2 && gIndex % 2 === 1
            ? 'draft'
            : template.status === 'completed'
              ? 'completed'
              : 'active',
        moderationStatus:
          tIndex === 2 && gIndex % 2 === 1
            ? 'pending'
            : template.status === 'completed'
              ? 'approved'
              : 'approved',
        participantCount,
        progress,
        createdAt: isoDaysAgo(Math.max(startOffset + 1, 1)),
        seedTag,
      });
    });
  });

  return challenges;
}

function buildWorkouts(challenges: SeedChallenge[], memberships: SeedMembership[]): SeedWorkout[] {
  const joinedByGroup = new Map<string, string[]>();
  memberships
    .filter((membership) => membership.status === 'joined')
    .forEach((membership) => {
      const list = joinedByGroup.get(membership.groupId) ?? [];
      if (!list.includes(membership.userId)) list.push(membership.userId);
      joinedByGroup.set(membership.groupId, list);
    });

  const workouts: SeedWorkout[] = [];
  let serial = 1;
  challenges.forEach((challenge, cIndex) => {
    const users = (joinedByGroup.get(challenge.groupId) ?? []).slice(0, 10);
    const daySpan = challenge.status === 'completed' ? 22 : 10;
    const totalEntries = challenge.status === 'draft' ? 10 : challenge.status === 'completed' ? 45 : 28;

    for (let i = 0; i < totalEntries; i += 1) {
      const activity = pick(challenge.activities, i);
      const userId = pick(users, i + cIndex);
      const valueBase = activity.unit.toLowerCase().includes('sec')
        ? 30
        : activity.unit.toLowerCase().includes('min')
          ? 12
          : 18;
      const value = valueBase + ((i + cIndex) % 9) * 4;
      const daysAgo = (i % daySpan) + (cIndex % 6);

      workouts.push({
        id: `seed_workout_${String(serial).padStart(4, '0')}`,
        userId,
        challengeId: challenge.id,
        exerciseId: activity.exerciseId,
        value,
        unit: activity.unit,
        groupId: challenge.groupId,
        completedAt: isoDaysAgo(daysAgo),
        notes: i % 7 === 0 ? 'Felt strong today.' : undefined,
        seedTag,
      });
      serial += 1;
    }
  });
  return workouts;
}

async function seedStaticContent() {
  const interestDocs = exerciseInterests.map(([id, name, icon], index) => ({
    id: `seed_interest_${id}`,
    sourceId: id,
    name,
    icon,
    category: 'Exercise',
    order: index + 1,
    isActive: true,
    isDefault: index < 8,
    seedTag,
  }));
  const goalDocs = wellnessGoals.map(([id, name, description, icon], index) => ({
    id: `seed_goal_${id}`,
    sourceId: id,
    name,
    description,
    icon,
    category: 'Wellness',
    order: index + 1,
    isActive: true,
    isDefault: index < 6,
    seedTag,
  }));

  const onboardingDocs = [
    {
      id: 'seed_onboarding_welcome',
      stepKey: 'welcome',
      title: 'Fitness is Better Together',
      body: 'Join groups, pick challenges, and stay accountable with your community.',
      version: 3,
      isActive: true,
      seedTag,
    },
    {
      id: 'seed_onboarding_interests',
      stepKey: 'interests',
      title: 'What moves you?',
      body: 'Pick exercise interests and wellness goals for personalized challenge matching.',
      version: 2,
      isActive: true,
      seedTag,
    },
    {
      id: 'seed_onboarding_privacy',
      stepKey: 'privacy',
      title: 'Final touches',
      body: 'Control profile visibility and community interactions.',
      version: 2,
      isActive: true,
      seedTag,
    },
  ];

  const notificationTemplates = [
    {
      id: 'seed_notification_group_joined',
      name: 'New Group Member Joined',
      channel: 'push',
      audience: 'group-admins',
      status: 'sent',
      updatedAt: isoDaysAgo(1),
      seedTag,
    },
    {
      id: 'seed_notification_challenge_reminder',
      name: 'Challenge Reminder',
      channel: 'in_app',
      audience: 'active-challenge-members',
      status: 'scheduled',
      updatedAt: isoDaysAgo(0),
      seedTag,
    },
    {
      id: 'seed_notification_reengagement',
      name: 'Re-engagement Campaign',
      channel: 'email',
      audience: 'inactive-14d',
      status: 'draft',
      updatedAt: isoDaysAgo(4),
      seedTag,
    },
  ];

  const challengeTemplates = [
    {
      id: 'seed_template_collective_squats',
      name: 'Squat Squad 100',
      description: 'Collective squat challenge with team-wide goals.',
      durationDays: 30,
      challengeType: 'collective',
      difficultyLevel: 'intermediate',
      activityCount: 2,
      version: 1,
      isPublished: true,
      activities: [
        { exerciseName: 'Squat', targetValue: 100, unit: 'reps' },
        { exerciseName: 'Plank', targetValue: 90, unit: 'seconds' },
      ],
      tag: 'Trending',
      popularityText: '2.4k joined',
      seedTag,
    },
    {
      id: 'seed_template_pushup_duel',
      name: '30-Day Pushup Duel',
      description: 'Competitive pushup ladder challenge.',
      durationDays: 30,
      challengeType: 'competitive',
      difficultyLevel: 'advanced',
      activityCount: 1,
      version: 1,
      isPublished: true,
      activities: [{ exerciseName: 'Pushup', targetValue: 1200, unit: 'reps' }],
      tag: 'Hardcore',
      popularityText: '1.1k joined',
      seedTag,
    },
    {
      id: 'seed_template_yoga_streak',
      name: '30-Day Yoga Streak',
      description: 'Daily streak challenge focused on consistency.',
      durationDays: 30,
      challengeType: 'streak',
      difficultyLevel: 'beginner',
      activityCount: 1,
      version: 1,
      isPublished: true,
      activities: [{ exerciseName: 'Yoga Session', targetValue: 30, unit: 'minutes' }],
      tag: 'Daily',
      popularityText: '3.1k joined',
      seedTag,
    },
  ];

  const supportTickets = [
    {
      id: 'seed_ticket_01',
      userId: 'seed_user_03',
      userEmail: 'njeri.kamau3@tiizi.test',
      subject: 'Cannot join private group',
      message: 'I requested to join Zen Yoga Community but status is still pending.',
      status: 'new',
      priority: 'high',
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
      seedTag,
    },
    {
      id: 'seed_ticket_02',
      userId: 'seed_user_09',
      userEmail: 'lisa.patel9@tiizi.test',
      subject: 'Workout log not reflected on leaderboard',
      message: 'My 5k run shows in activity but not in points.',
      status: 'in_progress',
      priority: 'medium',
      assignedTo: primaryUid || 'seed_user_01',
      createdAt: isoDaysAgo(2),
      updatedAt: isoDaysAgo(0),
      seedTag,
    },
    {
      id: 'seed_ticket_03',
      userId: 'seed_user_14',
      userEmail: 'elena.otieno14@tiizi.test',
      subject: 'Need help with profile setup',
      message: 'How do I change my privacy settings after onboarding?',
      status: 'resolved',
      priority: 'low',
      assignedTo: primaryUid || 'seed_user_02',
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(3),
      seedTag,
    },
  ];

  const groupReports = [
    {
      id: 'seed_report_01',
      groupId: 'seed_group_zen_yoga',
      groupName: 'Zen Yoga Community',
      reportType: 'challenge_content',
      reason: 'Challenge description includes unsafe instruction.',
      status: 'open',
      createdAt: isoDaysAgo(1),
      seedTag,
    },
    {
      id: 'seed_report_02',
      groupId: 'seed_group_squad_254',
      groupName: 'Squad 254',
      reportType: 'member_behavior',
      reason: 'Spam comments in group feed.',
      status: 'reviewed',
      createdAt: isoDaysAgo(3),
      reviewedBy: primaryUid || 'seed_user_02',
      reviewedAt: isoDaysAgo(2),
      seedTag,
    },
  ];

  const donationCampaigns = [
    {
      id: 'seed_campaign_01',
      name: 'Clean Water Initiative',
      goalAmount: 10000,
      raisedAmount: 8420,
      donorCount: 128,
      status: 'active',
      startDate: isoDaysAgo(35),
      endDate: isoDaysAgo(-20),
      seedTag,
    },
    {
      id: 'seed_campaign_02',
      name: 'Community Youth Fitness Fund',
      goalAmount: 7000,
      raisedAmount: 6940,
      donorCount: 96,
      status: 'completed',
      startDate: isoDaysAgo(120),
      endDate: isoDaysAgo(40),
      seedTag,
    },
    {
      id: 'seed_campaign_03',
      name: 'Women in Sport Weekend Drive',
      goalAmount: 5000,
      raisedAmount: 1100,
      donorCount: 24,
      status: 'active',
      startDate: isoDaysAgo(8),
      endDate: isoDaysAgo(-22),
      seedTag,
    },
  ];

  const donationTransactions = Array.from({ length: 28 }).map((_, i) => {
    const campaign = pick(donationCampaigns, i);
    return {
      id: `seed_tx_${String(i + 1).padStart(3, '0')}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      donorName: `Donor ${i + 1}`,
      donorEmail: `donor${i + 1}@tiizi.test`,
      amount: 10 + (i % 9) * 5,
      currency: 'USD',
      status: i % 11 === 0 ? 'pending' : i % 13 === 0 ? 'refunded' : 'success',
      createdAt: isoDaysAgo(i % 32),
      seedTag,
    };
  });

  const systemLogs = Array.from({ length: 20 }).map((_, i) => ({
    id: `seed_log_${String(i + 1).padStart(3, '0')}`,
    at: isoDaysAgo(i),
    actorUid: primaryUid || `seed_user_${String((i % 5) + 1).padStart(2, '0')}`,
    action: i % 3 === 0 ? 'challenge.approve' : i % 3 === 1 ? 'group.feature' : 'settings.update',
    targetType: i % 3 === 0 ? 'challenge' : i % 3 === 1 ? 'group' : 'settings',
    targetId: i % 3 === 0 ? `seed_challenge_${String((i % 12) + 1).padStart(2, '0')}` : i % 3 === 1 ? 'seed_group_early_birds' : 'app',
    severity: i % 7 === 0 ? 'warning' : 'info',
    note: 'Seeded system activity log entry.',
    seedTag,
  }));

  const admins = [
    {
      id: primaryUid || 'seed_user_01',
      role: 'super_admin',
      status: 'active',
      displayName: primaryUid ? 'Primary Test User' : 'Alex Rivera',
      email: primaryEmail || 'alex.rivera1@tiizi.test',
      seedTag,
    },
    {
      id: 'seed_user_02',
      role: 'moderator',
      status: 'active',
      displayName: 'Sarah Chen',
      email: 'sarah.chen2@tiizi.test',
      seedTag,
    },
    {
      id: 'seed_user_03',
      role: 'content_manager',
      status: 'active',
      displayName: 'Mike Kamau',
      email: 'mike.kamau3@tiizi.test',
      seedTag,
    },
    {
      id: 'seed_user_04',
      role: 'support',
      status: 'active',
      displayName: 'Njeri Otieno',
      email: 'njeri.otieno4@tiizi.test',
      seedTag,
    },
  ];

  const appSettings = [
    {
      id: 'app',
      appName: 'Tiizi Fitness',
      supportEmail: 'support@tiizi.app',
      termsUrl: 'https://tiizi.app/terms',
      privacyUrl: 'https://tiizi.app/privacy',
      maintenanceMode: false,
      maxChallengesPerUser: 12,
      maxGroupsPerUser: 10,
      maxWorkoutLogsPerDay: 40,
      seedTag,
    },
  ];

  await setDocs('exerciseInterests', interestDocs);
  await setDocs('wellnessGoals', goalDocs);
  await setDocs('onboardingContent', onboardingDocs);
  await setDocs('notificationTemplates', notificationTemplates);
  await setDocs('challengeTemplates', challengeTemplates);
  await setDocs('supportTickets', supportTickets);
  await setDocs('groupReports', groupReports);
  await setDocs('donationCampaigns', donationCampaigns);
  await setDocs('donationTransactions', donationTransactions);
  await setDocs('systemLogs', systemLogs);
  await setDocs('admins', admins);
  await setDocs('settings', appSettings);
}

async function main() {
  console.log(`\nSeeding Tiizi data set (${seedTag})...`);
  console.log(`Project: ${projectId}`);
  if (primaryUid) {
    console.log(`Primary UID: ${primaryUid}`);
  }

  const cleanupCollections = [
    'users',
    'groups',
    'groupMembers',
    'challenges',
    'workouts',
    'exerciseInterests',
    'wellnessGoals',
    'onboardingContent',
    'notificationTemplates',
    'challengeTemplates',
    'supportTickets',
    'groupReports',
    'donationCampaigns',
    'donationTransactions',
    'systemLogs',
    'admins',
    'settings',
  ];

  for (const collectionName of cleanupCollections) {
    const deleted = await deleteSeededDocs(collectionName);
    if (deleted > 0) {
      console.log(`Removed ${deleted} existing seeded docs from ${collectionName}`);
    }
  }

  await ensureCatalogExercisesLoaded();

  const exercisePool = await getExercisePool();
  const users = buildUsers();
  const groups = buildGroups(users);
  const memberships = buildMemberships(groups, users);
  const challenges = buildChallenges(groups, memberships, exercisePool);
  const workouts = buildWorkouts(challenges, memberships);

  const groupMemberCounts = new Map<string, number>();
  memberships
    .filter((membership) => membership.status === 'joined')
    .forEach((membership) => {
      groupMemberCounts.set(membership.groupId, (groupMemberCounts.get(membership.groupId) ?? 0) + 1);
    });
  const groupsWithCounts = groups.map((group) => ({
    ...group,
    memberCount: groupMemberCounts.get(group.id) ?? 1,
  }));

  await setDocs('users', users);
  await setDocs('groups', groupsWithCounts);
  await setDocs('groupMembers', memberships);
  await setDocs('challenges', challenges);
  await setDocs('workouts', workouts);
  await seedStaticContent();

  const summary = {
    users: users.length,
    groups: groupsWithCounts.length,
    memberships: memberships.length,
    challenges: challenges.length,
    workouts: workouts.length,
  };

  console.log('\nSeed complete.');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nTip: run the app and test My Groups, Group Detail tabs, Challenges, Log Workout, Feed, and Admin modules.');
}

main().catch((error) => {
  console.error('\nSeed failed:', error);
  process.exit(1);
});
