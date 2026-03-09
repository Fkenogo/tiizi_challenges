# 🌟 WELLNESS CHALLENGE SYSTEM - COMPLETE SPECIFICATION

**Two-Stage System: Activity Library + Challenge Creation**

---

## 📋 TABLE OF CONTENTS

1. [System Architecture](#system-architecture)
2. [Stage 1: Wellness Activity Library](#stage-1-wellness-activity-library)
3. [Stage 2: Wellness Challenge Creation Form](#stage-2-wellness-challenge-creation-form)
4. [Data Schema](#data-schema)
5. [UI Specifications](#ui-specifications)
6. [Implementation Guide](#implementation-guide)
7. [Code Examples](#code-examples)

---

## 🏗️ SYSTEM ARCHITECTURE

### Two-Stage Approach

```
┌─────────────────────────────────────────────────────────┐
│                    STAGE 1                               │
│           WELLNESS ACTIVITY LIBRARY                      │
│                                                          │
│  Pre-built wellness activities stored in Firestore:     │
│  - Fasting activities (16hr, 24hr, 48hr, etc.)         │
│  - Hydration activities (2L daily, morning ritual)      │
│  - Sleep activities (8hr streak, consistency)           │
│  - Meditation, Nutrition, Habits, etc.                  │
│                                                          │
│  Each activity includes:                                │
│  • Protocol details                                     │
│  • Benefits                                             │
│  • Guidelines                                           │
│  • Warnings                                             │
│  • Default targets & metrics                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    STAGE 2                               │
│        WELLNESS CHALLENGE CREATION FORM                  │
│                                                          │
│  User creates custom challenge by:                      │
│  1. Adding challenge info (name, description, image)    │
│  2. Selecting challenge type (collective/competitive)   │
│  3. Setting dates (start/end → duration calculated)     │
│  4. Browsing & adding activities from library           │
│  5. Customizing targets for each activity               │
│  6. Publishing to group                                 │
│                                                          │
│  Result: Custom wellness challenge with selected        │
│  activities, each retaining full details from library   │
└─────────────────────────────────────────────────────────┘
```

### Key Difference from Fitness Challenges

**Fitness Challenges:**
- Activity = Exercise from catalog
- Simple metrics (reps, time, distance)
- Minimal additional context

**Wellness Challenges:**
- Activity = Complex wellness protocol
- Rich context (benefits, guidelines, warnings)
- Multiple components per activity

---

## 📚 STAGE 1: WELLNESS ACTIVITY LIBRARY

### Purpose

A **searchable, categorized library** of pre-built wellness activities that users can add to their challenges.

### Firestore Structure

```
/wellnessActivities/
  ├── fasting-16hr/
  ├── fasting-24hr/
  ├── hydration-2l/
  ├── sleep-8hr/
  ├── meditation-5min/
  └── ... (60+ activities)
```

### Activity Document Schema

```typescript
interface WellnessActivity {
  // Identification
  id: string;                           // e.g., "fasting-16hr"
  category: 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 
            'nutrition' | 'habits' | 'stress' | 'social';
  
  // Basic Info
  name: string;                         // "16-Hour Daily Fast"
  shortName: string;                    // "16hr Fast"
  description: string;                  // Brief description
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  icon: string;                         // "🕐"
  coverImage?: string;                  // Default image URL
  
  // Activity Type (determines logging interface)
  activityType: 'fasting' | 'water' | 'sleep' | 'meditation' | 
                'food' | 'habit' | 'breathing' | 'social';
  
  // Default Targets (user can customize)
  defaultMetricUnit: string;            // "hours", "ml", "servings", "minutes"
  defaultTargetValue: number;           // 16, 2000, 5, 30
  suggestedFrequency: number;           // Times per day
  
  // Protocol Details (displayed in activity detail)
  protocolSteps?: string[];             // Step-by-step instructions
  fastingProtocol?: {                   // For fasting activities
    fastingHours: number;
    eatingHours: number;
    startTime?: string;
    endTime?: string;
  };
  hydrationProtocol?: {                 // For hydration activities
    dailyTarget: number;
    containerSize: number;
    timing?: string[];
  };
  sleepProtocol?: {                     // For sleep activities
    targetHours: number;
    bedtimeWindow?: string;
    wakeWindow?: string;
    consistency: boolean;
  };
  
  // Rich Context (retained in challenge)
  benefits: string[];                   // List of benefits
  benefitsTimeline?: {                  // When benefits appear
    week1: string[];
    week2: string[];
    week3plus: string[];
  };
  guidelines: string[];                 // How to do it safely
  warnings?: string[];                  // Medical warnings
  contraindications?: string[];         // Who should not do this
  
  // Body Response (for fasting)
  bodyResponse?: {
    timeRange: string;                  // "0-4 hours"
    title: string;                      // "Digestion Phase"
    description: string;
    effects: string[];
  }[];
  
  // Points & Gamification
  defaultPoints: number;                // Base points per completion
  bonusConditions?: {
    condition: string;
    points: number;
  }[];
  
  // Metadata
  popular: boolean;                     // Featured in browse
  medicalSupervisionRequired: boolean;  // For 48hr+ fasts
  prerequisite?: string;                // Required activity ID
  tags: string[];                       // For search
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Activity Categories & Count

| Category | Activities | Examples |
|----------|------------|----------|
| **Fasting** | 8 | 16hr, 18hr, 20hr, 24hr, 48hr, 72hr, ADF, 5:2 |
| **Hydration** | 8 | 2L daily, 3L daily, 4L daily, Morning ritual, Pre-meal |
| **Sleep** | 7 | 8hr streak, Consistency, Early bedtime, Screen-free |
| **Mindfulness** | 8 | 5min meditation, 10min, 20min, Gratitude, Breathing |
| **Nutrition** | 7 | 5-a-day veggies, 7-a-day, Protein target, No sugar |
| **Habits** | 8 | Morning routine, Evening routine, No alcohol, Reading |
| **Stress** | 7 | Deep breathing, Nature walks, Journaling, PMR |
| **Social** | 7 | Daily connection, Acts of kindness, Face-to-face |

**Total:** 60+ wellness activities

---

## 📝 STAGE 2: WELLNESS CHALLENGE CREATION FORM

### Purpose

A **customizable form** (matching fitness challenge UX) where users compose wellness challenges by selecting activities from the library and setting custom targets.

### Form Flow

```
1. CHALLENGE INFO
   ├── Upload Cover Image
   ├── Challenge Name
   └── Challenge Description

2. CHALLENGE TYPE
   ├── Collective
   ├── Competitive
   └── Streak

3. TIMELINE
   ├── Start Date
   ├── End Date
   └── Duration (auto-calculated)

4. ACTIVITIES (★ Core Customization)
   ├── Browse Activity Library
   │   ├── Filter by Category
   │   └── Search Activities
   ├── Select Activity
   ├── View Activity Details
   │   ├── Protocol
   │   ├── Benefits
   │   ├── Guidelines
   │   └── Warnings
   ├── Customize Targets
   │   ├── Target Value
   │   ├── Metric Unit
   │   └── Frequency
   └── Add Multiple Activities

5. OPTIONAL: CHARITY SUPPORT
   ├── Toggle On/Off
   ├── Cause Description
   └── Target Donation

6. PUBLISH
   └── Launch Challenge to Group
```

### Activity Selection UI

**Browse Modal:**

```
┌─────────────────────────────────────────────────────┐
│  ← Back              Add Activity               ✓   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🔍 Search activities...                            │
│                                                      │
│  [All] [Fasting] [Hydration] [Sleep] [Mindfulness] │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  🕐  16-Hour Daily Fast          ⭐⭐☆☆☆     │  │
│  │      Beginner • 16 hours                     │  │
│  │      Fast for 16hrs, eat in 8hr window      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  💧  Daily Hydration (2L)        ⭐⭐☆☆☆     │  │
│  │      Beginner • 2 liters                     │  │
│  │      Drink 2L water throughout the day      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  😴  8-Hour Sleep Streak         ⭐⭐☆☆☆     │  │
│  │      Beginner • 8 hours                      │  │
│  │      Get 8 hours of sleep nightly           │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Activity Detail View:**

```
┌─────────────────────────────────────────────────────┐
│  ← Back          Activity Detail              Add → │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🕐  FASTING                                        │
│  16-Hour Daily Fast (Beginner Friendly)            │
│                                                      │
│  The 16/8 intermittent fasting protocol - fast     │
│  for 16 hours, eat within 8-hour window.           │
│                                                      │
│  [beginner] [16 hours] [streak]                    │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  PROTOCOL DETAILS                            │  │
│  │  • Fast for 16 hours (8 PM - 12 PM)         │  │
│  │  • Eat within 8-hour window                  │  │
│  │  • Stay hydrated (water, coffee, tea)       │  │
│  │  • Daily frequency                            │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  BENEFITS                                     │  │
│  │  ✓ Improved mental clarity                   │  │
│  │  ✓ Weight loss (0.5-1kg/week)               │  │
│  │  ✓ Better insulin sensitivity                │  │
│  │  ✓ Reduced inflammation                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ⚠️ WARNINGS                                        │
│  • Not for pregnant/breastfeeding women          │  │
│  • Consult doctor if on medications              │  │
│                                                      │
│  CUSTOMIZE TARGETS                                  │
│  Target Value:  [16] hours                         │
│  Frequency:     [Daily ▼]                          │
│                                                      │
│  [Add to Challenge]                                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Added Activities List:**

```
┌─────────────────────────────────────────────────────┐
│  Challenge Activities                         (2)    │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │  🕐  16-Hour Fast                    [Edit] │  │
│  │      Target: 16 hours • Daily               │  │
│  │      10 points per completion                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  💧  Hydration (2L)                  [Edit] │  │
│  │      Target: 2000ml • Daily                  │  │
│  │      10 points per completion                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [+ Add Another Activity]                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📊 DATA SCHEMA

### Challenge Document (Created from Form)

```typescript
interface WellnessChallenge {
  // Basic Info (from form)
  id: string;
  groupId: string;
  name: string;                         // User-entered
  description: string;                  // User-entered
  coverImage?: string;                  // User-uploaded or default
  
  // Challenge Settings (from form)
  category: 'wellness';                 // Always wellness
  type: 'collective' | 'competitive' | 'streak';
  
  // Timeline (from form)
  startDate: Timestamp;                 // User-selected
  endDate: Timestamp;                   // User-selected
  duration: number;                     // Auto-calculated (days)
  
  // Activities (selected from library + customized)
  activities: {
    activityId: string;                 // Reference to wellnessActivity
    order: number;                      // Display order
    
    // From Library (inherited)
    activityType: string;               // fasting, water, sleep, etc.
    name: string;
    description: string;
    category: string;
    difficulty: string;
    icon: string;
    
    // Customized by User
    targetValue: number;                // User can change
    metricUnit: string;                 // User can change
    frequency: 'daily' | 'weekly' | '3x-week' | 'custom';
    
    // Rich Context (inherited from library)
    protocolSteps: string[];
    benefits: string[];
    guidelines: string[];
    warnings: string[];
    bodyResponse?: any;                 // For fasting
    
    // Points (can be customized)
    pointsPerCompletion: number;
    bonusPoints?: {
      condition: string;
      points: number;
    }[];
  }[];
  
  // Optional Charity
  charityEnabled: boolean;
  charityDescription?: string;
  charityTarget?: number;
  
  // Metadata
  status: 'draft' | 'active' | 'completed';
  participantCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Activity Reference Pattern

When user adds activity from library:

```typescript
// 1. User selects activity from library
const libraryActivity = await getDoc(doc(db, 'wellnessActivities', 'fasting-16hr'));

// 2. User customizes targets in form
const customizedActivity = {
  activityId: 'fasting-16hr',          // Reference to library
  order: 1,
  
  // Inherited from library
  activityType: libraryActivity.activityType,
  name: libraryActivity.name,
  description: libraryActivity.description,
  category: libraryActivity.category,
  difficulty: libraryActivity.difficulty,
  icon: libraryActivity.icon,
  protocolSteps: libraryActivity.protocolSteps,
  benefits: libraryActivity.benefits,
  guidelines: libraryActivity.guidelines,
  warnings: libraryActivity.warnings,
  bodyResponse: libraryActivity.bodyResponse,
  
  // Customized by user
  targetValue: 16,                      // User changed from default
  metricUnit: 'hours',                  // User selected
  frequency: 'daily',                   // User selected
  pointsPerCompletion: 15,              // User increased from 10
};

// 3. Add to challenge
challenge.activities.push(customizedActivity);
```

---

## 🎨 UI SPECIFICATIONS

### Creation Form Layout

**Matching Fitness Challenge Form Structure:**

```
┌─────────────────────────────────────────────────────┐
│  ← Back          New Challenge                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │   📷 Upload Challenge Cover                   │ │
│  │        Add a visual for your challenge        │ │
│  │        [Choose Image]                          │ │
│  └───────────────────────────────────────────────┘ │
│                                                      │
│  INFO                                               │
│  Challenge Name                                     │
│  [e.g. 30 Day Wellness Reset]                      │
│                                                      │
│  Challenge Description                              │
│  [Tell everyone what this is about...]             │
│                                                      │
│  CHALLENGE TYPE                                     │
│  [COLLECTIVE] [Competitive] [Streak]               │
│                                                      │
│  TIMELINE                                           │
│  Start Date        End Date                         │
│  [mm/dd/yyyy]      [mm/dd/yyyy]                    │
│  Duration: 21 days (auto-calculated)               │
│                                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │  CHALLENGE ACTIVITIES                         │ │
│  │                                                │ │
│  │  🕐  16-Hour Fast                    [Edit] │ │
│  │      Target: 16 hours • Daily               │ │
│  │                                                │ │
│  │  💧  Hydration (2L)                  [Edit] │ │
│  │      Target: 2000ml • Daily                  │ │
│  │                                                │ │
│  │  [+ Add Activity from Library]               │ │
│  └───────────────────────────────────────────────┘ │
│                                                      │
│  INFO (Optional)                          [Toggle]  │
│  Raise money for a charity                         │
│                                                      │
│  [🚀 Launch Challenge]                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Activity Browser Modal

**When user taps "Add Activity from Library":**

```tsx
<Modal>
  <Header>
    <BackButton />
    <Title>Add Wellness Activity</Title>
    <CloseButton />
  </Header>
  
  <SearchBar placeholder="Search activities..." />
  
  <CategoryTabs>
    <Tab active>All</Tab>
    <Tab>Fasting</Tab>
    <Tab>Hydration</Tab>
    <Tab>Sleep</Tab>
    <Tab>Mindfulness</Tab>
    <Tab>More...</Tab>
  </CategoryTabs>
  
  <ActivityList>
    {activities.map(activity => (
      <ActivityCard
        icon={activity.icon}
        name={activity.name}
        difficulty={activity.difficulty}
        description={activity.description}
        onClick={() => showActivityDetail(activity)}
      />
    ))}
  </ActivityList>
</Modal>
```

### Activity Detail Modal

**When user taps an activity card:**

```tsx
<Modal fullScreen>
  <Header>
    <BackButton />
    <Title>Activity Detail</Title>
    <AddButton onClick={addToChallenge} />
  </Header>
  
  <ScrollView>
    {/* Hero */}
    <ActivityHero
      icon={activity.icon}
      category={activity.category}
      name={activity.name}
      description={activity.description}
      difficulty={activity.difficulty}
    />
    
    {/* Quick Info */}
    <QuickInfo>
      <InfoCard label="Duration" value={activity.defaultTargetValue + " " + activity.defaultMetricUnit} />
      <InfoCard label="Frequency" value="Daily" />
      <InfoCard label="Difficulty" value={activity.difficulty} />
    </QuickInfo>
    
    {/* Protocol Details */}
    {activity.protocolSteps && (
      <Section title="Protocol Details">
        <Card>
          {activity.protocolSteps.map(step => (
            <ListItem>{step}</ListItem>
          ))}
        </Card>
      </Section>
    )}
    
    {/* Benefits */}
    <Section title="Benefits">
      <Card variant="flat">
        {activity.benefits.map(benefit => (
          <BenefitItem icon="✓" text={benefit} />
        ))}
      </Card>
    </Section>
    
    {/* Guidelines */}
    <Section title="Guidelines">
      <Card variant="flat">
        {activity.guidelines.map(guideline => (
          <GuidelineItem icon="ℹ️" text={guideline} />
        ))}
      </Card>
    </Section>
    
    {/* Warnings */}
    {activity.warnings && activity.warnings.length > 0 && (
      <Section title="Warnings">
        <Card className="bg-red-50 border-red-200">
          {activity.warnings.map(warning => (
            <WarningItem icon="⚠️" text={warning} />
          ))}
        </Card>
      </Section>
    )}
    
    {/* Customize Targets */}
    <Section title="Customize Targets">
      <Card>
        <InputGroup>
          <Label>Target Value</Label>
          <Input
            type="number"
            value={targetValue}
            onChange={setTargetValue}
          />
        </InputGroup>
        
        <InputGroup>
          <Label>Metric Unit</Label>
          <Select
            value={metricUnit}
            onChange={setMetricUnit}
          >
            <option>{activity.defaultMetricUnit}</option>
            {/* Other relevant units */}
          </Select>
        </InputGroup>
        
        <InputGroup>
          <Label>Frequency</Label>
          <Select
            value={frequency}
            onChange={setFrequency}
          >
            <option value="daily">Daily</option>
            <option value="3x-week">3x per week</option>
            <option value="weekly">Weekly</option>
          </Select>
        </InputGroup>
      </Card>
    </Section>
  </ScrollView>
  
  <FixedFooter>
    <Button primary fullWidth onClick={addToChallenge}>
      Add to Challenge
    </Button>
  </FixedFooter>
</Modal>
```

### Mobile Constraints

**All UI must follow:**

- Spacing: p-3, p-4, p-6 only (NO p-5, p-8)
- Gaps: gap-2, gap-3 only
- Typography: text-xs through text-3xl only
- Tap targets: h-11 minimum (44px)
- Components: Use Screen, Section, Card, ListItem
- Viewport: Optimize for 375px

---

## 🔧 IMPLEMENTATION GUIDE

### Phase 1: Setup Activity Library (Week 1)

**Step 1: Create Firestore Collection**

```typescript
// scripts/seedWellnessActivities.ts

import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import activities from './data/wellnessActivities.json';

async function seedActivities() {
  const activitiesRef = collection(db, 'wellnessActivities');
  
  for (const activity of activities) {
    await setDoc(doc(activitiesRef, activity.id), {
      ...activity,
      createdAt: new Date(),
      updatedAt: new Date(),
      popular: activity.difficulty === 'beginner',
    });
    
    console.log(`✓ Seeded: ${activity.name}`);
  }
  
  console.log('✓ All wellness activities seeded');
}

seedActivities();
```

**Step 2: Create Activity Service**

```typescript
// src/services/wellnessActivityService.ts

export const wellnessActivityService = {
  /**
   * Get all wellness activities
   */
  async getAllActivities() {
    const q = query(
      collection(db, 'wellnessActivities'),
      orderBy('category'),
      orderBy('difficulty')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  /**
   * Get activities by category
   */
  async getActivitiesByCategory(category: string) {
    const q = query(
      collection(db, 'wellnessActivities'),
      where('category', '==', category),
      orderBy('difficulty')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  /**
   * Search activities
   */
  async searchActivities(searchTerm: string) {
    // Note: For production, use Algolia or similar
    const all = await this.getAllActivities();
    return all.filter(activity =>
      activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  },
  
  /**
   * Get popular activities
   */
  async getPopularActivities(limit: number = 10) {
    const q = query(
      collection(db, 'wellnessActivities'),
      where('popular', '==', true),
      limit(limit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
};
```

### Phase 2: Build Creation Form (Week 2)

**Step 1: Create Form Component**

```typescript
// src/features/Challenges/CreateWellnessChallengeScreen.tsx

export function CreateWellnessChallengeScreen() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [challengeType, setChallengeType] = useState<'collective' | 'competitive' | 'streak'>('collective');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activities, setActivities] = useState<CustomizedActivity[]>([]);
  const [charityEnabled, setCharityEnabled] = useState(false);
  const [charityDescription, setCharityDescription] = useState('');
  const [charityTarget, setCharityTarget] = useState('');
  
  // Modals
  const [showActivityBrowser, setShowActivityBrowser] = useState(false);
  const [showActivityDetail, setShowActivityDetail] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<WellnessActivity | null>(null);
  
  // Calculate duration
  const duration = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);
  
  // Add activity to challenge
  const handleAddActivity = (
    activity: WellnessActivity,
    customization: {
      targetValue: number;
      metricUnit: string;
      frequency: string;
      pointsPerCompletion: number;
    }
  ) => {
    const customizedActivity: CustomizedActivity = {
      activityId: activity.id,
      order: activities.length + 1,
      
      // From library
      activityType: activity.activityType,
      name: activity.name,
      description: activity.description,
      category: activity.category,
      difficulty: activity.difficulty,
      icon: activity.icon,
      protocolSteps: activity.protocolSteps,
      benefits: activity.benefits,
      guidelines: activity.guidelines,
      warnings: activity.warnings,
      bodyResponse: activity.bodyResponse,
      
      // Customized
      targetValue: customization.targetValue,
      metricUnit: customization.metricUnit,
      frequency: customization.frequency,
      pointsPerCompletion: customization.pointsPerCompletion,
      bonusPoints: activity.bonusConditions,
    };
    
    setActivities([...activities, customizedActivity]);
    setShowActivityDetail(false);
    setShowActivityBrowser(false);
  };
  
  // Create challenge
  const handleCreateChallenge = async () => {
    try {
      const challengeRef = doc(collection(db, 'challenges'));
      
      await setDoc(challengeRef, {
        id: challengeRef.id,
        groupId,
        name,
        description,
        coverImage,
        category: 'wellness',
        type: challengeType,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        duration,
        activities,
        charityEnabled,
        charityDescription: charityEnabled ? charityDescription : null,
        charityTarget: charityEnabled ? Number(charityTarget) : null,
        status: 'draft',
        participantCount: 0,
        createdBy: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      navigate(`/groups/${groupId}/challenges/${challengeRef.id}`);
    } catch (error) {
      console.error('Error creating challenge:', error);
    }
  };
  
  return (
    <Screen>
      <Header>
        <BackButton />
        <Title>New Wellness Challenge</Title>
      </Header>
      
      {/* Cover Image Upload */}
      <Section>
        <ImageUpload
          value={coverImage}
          onChange={setCoverImage}
          placeholder="Upload Challenge Cover"
        />
      </Section>
      
      {/* Info */}
      <Section title="Info">
        <Input
          label="Challenge Name"
          placeholder="e.g. 30 Day Wellness Reset"
          value={name}
          onChange={setName}
        />
        <Textarea
          label="Challenge Description"
          placeholder="Tell everyone what this is about..."
          value={description}
          onChange={setDescription}
          rows={3}
        />
      </Section>
      
      {/* Challenge Type */}
      <Section title="Challenge Type">
        <TypeSelector
          value={challengeType}
          onChange={setChallengeType}
          options={['collective', 'competitive', 'streak']}
        />
      </Section>
      
      {/* Timeline */}
      <Section title="Timeline">
        <div className="grid grid-cols-2 gap-3">
          <DateInput
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
          />
          <DateInput
            label="End Date"
            value={endDate}
            onChange={setEndDate}
          />
        </div>
        {duration > 0 && (
          <p className="text-sm text-slate-600 mt-2">
            Duration: {duration} days
          </p>
        )}
      </Section>
      
      {/* Activities */}
      <Section title="Challenge Activities">
        <Card variant="flat">
          {activities.map((activity, index) => (
            <ActivityListItem
              key={index}
              activity={activity}
              onEdit={() => editActivity(index)}
              onRemove={() => removeActivity(index)}
            />
          ))}
          
          <Button
            variant="outline"
            fullWidth
            onClick={() => setShowActivityBrowser(true)}
          >
            <PlusIcon />
            Add Activity from Library
          </Button>
        </Card>
      </Section>
      
      {/* Optional Charity */}
      <Section title="Info (Optional)">
        <ToggleSection
          title="Raise money for a charity"
          enabled={charityEnabled}
          onToggle={setCharityEnabled}
        >
          <Input
            label="Cause Description"
            placeholder="e.g. Save the Oceans Foundation"
            value={charityDescription}
            onChange={setCharityDescription}
          />
          <Input
            label="Target Total Donation ($)"
            type="number"
            placeholder="500"
            value={charityTarget}
            onChange={setCharityTarget}
          />
        </ToggleSection>
      </Section>
      
      {/* Submit */}
      <FixedFooter>
        <Button
          primary
          fullWidth
          onClick={handleCreateChallenge}
          disabled={!name || !startDate || !endDate || activities.length === 0}
        >
          🚀 Launch Challenge
        </Button>
      </FixedFooter>
      
      {/* Activity Browser Modal */}
      {showActivityBrowser && (
        <ActivityBrowserModal
          onClose={() => setShowActivityBrowser(false)}
          onSelectActivity={(activity) => {
            setSelectedActivity(activity);
            setShowActivityBrowser(false);
            setShowActivityDetail(true);
          }}
        />
      )}
      
      {/* Activity Detail Modal */}
      {showActivityDetail && selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => {
            setShowActivityDetail(false);
            setSelectedActivity(null);
          }}
          onAdd={handleAddActivity}
        />
      )}
    </Screen>
  );
}
```

**Step 2: Create Activity Browser Modal**

```typescript
// src/components/Wellness/ActivityBrowserModal.tsx

export function ActivityBrowserModal({ onClose, onSelectActivity }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activities, setActivities] = useState<WellnessActivity[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadActivities();
  }, [selectedCategory, searchTerm]);
  
  const loadActivities = async () => {
    setLoading(true);
    try {
      let data;
      if (searchTerm) {
        data = await wellnessActivityService.searchActivities(searchTerm);
      } else if (selectedCategory === 'all') {
        data = await wellnessActivityService.getAllActivities();
      } else {
        data = await wellnessActivityService.getActivitiesByCategory(selectedCategory);
      }
      setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal fullScreen onClose={onClose}>
      <Header>
        <BackButton onClick={onClose} />
        <Title>Add Wellness Activity</Title>
      </Header>
      
      {/* Search */}
      <div className="p-4">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search activities..."
        />
      </div>
      
      {/* Category Tabs */}
      <ScrollableTabBar>
        <Tab
          active={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
        >
          All
        </Tab>
        <Tab
          active={selectedCategory === 'fasting'}
          onClick={() => setSelectedCategory('fasting')}
        >
          Fasting
        </Tab>
        <Tab
          active={selectedCategory === 'hydration'}
          onClick={() => setSelectedCategory('hydration')}
        >
          Hydration
        </Tab>
        <Tab
          active={selectedCategory === 'sleep'}
          onClick={() => setSelectedCategory('sleep')}
        >
          Sleep
        </Tab>
        <Tab
          active={selectedCategory === 'mindfulness'}
          onClick={() => setSelectedCategory('mindfulness')}
        >
          Mindfulness
        </Tab>
        {/* More categories... */}
      </ScrollableTabBar>
      
      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-3">
            {activities.map(activity => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onClick={() => onSelectActivity(activity)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ActivityCard({ activity, onClick }) {
  return (
    <Card interactive onClick={onClick}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">{activity.icon}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold mb-1">{activity.name}</h3>
          <p className="text-sm text-slate-600 mb-2 line-clamp-2">
            {activity.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="capitalize">{activity.difficulty}</span>
            <span>•</span>
            <span>{activity.defaultTargetValue} {activity.defaultMetricUnit}</span>
          </div>
        </div>
        
        {/* Arrow */}
        <ChevronRight className="text-slate-400" size={20} />
      </div>
    </Card>
  );
}
```

**Step 3: Create Activity Detail Modal**

```typescript
// src/components/Wellness/ActivityDetailModal.tsx

export function ActivityDetailModal({ activity, onClose, onAdd }) {
  // Customization state
  const [targetValue, setTargetValue] = useState(activity.defaultTargetValue);
  const [metricUnit, setMetricUnit] = useState(activity.defaultMetricUnit);
  const [frequency, setFrequency] = useState('daily');
  const [pointsPerCompletion, setPointsPerCompletion] = useState(activity.defaultPoints);
  
  const handleAdd = () => {
    onAdd(activity, {
      targetValue,
      metricUnit,
      frequency,
      pointsPerCompletion,
    });
  };
  
  return (
    <Modal fullScreen onClose={onClose}>
      <Header>
        <BackButton onClick={onClose} />
        <Title>Activity Detail</Title>
      </Header>
      
      <ScrollView className="flex-1 pb-24">
        {/* Hero */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{activity.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase text-primary">
                {activity.category}
              </p>
              <h1 className="text-2xl font-bold">{activity.name}</h1>
            </div>
          </div>
          <p className="text-base text-slate-600 mb-3">
            {activity.description}
          </p>
          <div className="flex gap-2">
            <Badge>{activity.difficulty}</Badge>
            <Badge>{activity.defaultTargetValue} {activity.defaultMetricUnit}</Badge>
            <Badge>{activity.activityType}</Badge>
          </div>
        </div>
        
        {/* Protocol Details */}
        {activity.protocolSteps && activity.protocolSteps.length > 0 && (
          <Section title="Protocol Details">
            <Card className="bg-slate-50">
              {activity.protocolSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <p className="text-sm flex-1">{step}</p>
                </div>
              ))}
            </Card>
          </Section>
        )}
        
        {/* Benefits */}
        <Section title="Benefits">
          <Card variant="flat">
            {activity.benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="text-green-600" size={14} />
                </div>
                <p className="text-sm flex-1">{benefit}</p>
              </div>
            ))}
          </Card>
        </Section>
        
        {/* Guidelines */}
        <Section title="Guidelines">
          <Card variant="flat">
            {activity.guidelines.map((guideline, index) => (
              <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                <div className="text-primary">
                  <AlertCircle size={20} />
                </div>
                <p className="text-sm flex-1">{guideline}</p>
              </div>
            ))}
          </Card>
        </Section>
        
        {/* Warnings */}
        {activity.warnings && activity.warnings.length > 0 && (
          <Section title="Important Warnings">
            <Card className="bg-red-50 border-2 border-red-200">
              {activity.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                  <div className="text-red-600">
                    <AlertTriangle size={20} />
                  </div>
                  <p className="text-sm flex-1 text-red-900">{warning}</p>
                </div>
              ))}
            </Card>
          </Section>
        )}
        
        {/* Customize Targets */}
        <Section title="Customize Targets">
          <Card>
            <InputGroup>
              <Label>Target Value</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
              />
            </InputGroup>
            
            <InputGroup>
              <Label>Metric Unit</Label>
              <Select
                value={metricUnit}
                onChange={(e) => setMetricUnit(e.target.value)}
              >
                <option value={activity.defaultMetricUnit}>
                  {activity.defaultMetricUnit}
                </option>
                {/* Add other relevant units based on activity type */}
              </Select>
            </InputGroup>
            
            <InputGroup>
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="3x-week">3x per week</option>
                <option value="weekly">Weekly</option>
              </Select>
            </InputGroup>
            
            <InputGroup>
              <Label>Points per Completion</Label>
              <Input
                type="number"
                value={pointsPerCompletion}
                onChange={(e) => setPointsPerCompletion(Number(e.target.value))}
              />
            </InputGroup>
          </Card>
        </Section>
      </ScrollView>
      
      {/* Fixed Footer */}
      <FixedFooter>
        <Button primary fullWidth onClick={handleAdd}>
          Add to Challenge
        </Button>
      </FixedFooter>
    </Modal>
  );
}
```

---

## 💻 CODE EXAMPLES

### Complete Example: Creating a Mixed Wellness Challenge

```typescript
// Example: User creates "30 Day Reset" challenge with multiple activities

const challenge = {
  name: "30 Day Wellness Reset",
  description: "Transform your health with fasting, hydration, and meditation",
  coverImage: "https://example.com/wellness-reset.jpg",
  type: "collective",
  startDate: "2026-03-01",
  endDate: "2026-03-30",
  duration: 30, // auto-calculated
  
  activities: [
    {
      // Activity 1: Fasting (from library)
      activityId: "fasting-16hr",
      order: 1,
      activityType: "fasting",
      name: "16-Hour Daily Fast",
      description: "Fast for 16 hours, eat in 8-hour window",
      category: "fasting",
      difficulty: "beginner",
      icon: "🕐",
      
      // User customized target
      targetValue: 16,
      metricUnit: "hours",
      frequency: "daily",
      pointsPerCompletion: 15, // User increased from default 10
      
      // Rich context from library
      protocolSteps: [
        "Stop eating by 8:00 PM",
        "Sleep through most of the fast",
        "Break fast at 12:00 PM the next day",
        "Stay hydrated with water, coffee, tea"
      ],
      benefits: [
        "Improved mental clarity",
        "Weight loss (0.5-1kg/week)",
        "Better insulin sensitivity"
      ],
      guidelines: [
        "Stay well-hydrated",
        "Break fast if feeling unwell",
        "Focus on nutritious foods"
      ],
      warnings: [
        "Not for pregnant/breastfeeding women",
        "Consult doctor if on medications"
      ],
      bodyResponse: [...] // Full timeline
    },
    
    {
      // Activity 2: Hydration (from library)
      activityId: "hydration-2l",
      order: 2,
      activityType: "water",
      name: "Daily Hydration (2L)",
      description: "Drink 2 liters of water daily",
      category: "hydration",
      difficulty: "beginner",
      icon: "💧",
      
      // User customized target
      targetValue: 2500, // User increased to 2.5L
      metricUnit: "ml",
      frequency: "daily",
      pointsPerCompletion: 10,
      
      // Rich context from library
      protocolSteps: [...],
      benefits: [...],
      guidelines: [...],
    },
    
    {
      // Activity 3: Meditation (from library)
      activityId: "meditation-5min",
      order: 3,
      activityType: "meditation",
      name: "5-Minute Daily Meditation",
      description: "Practice mindfulness meditation",
      category: "mindfulness",
      difficulty: "beginner",
      icon: "🧘",
      
      // User kept defaults
      targetValue: 5,
      metricUnit: "minutes",
      frequency: "daily",
      pointsPerCompletion: 10,
      
      // Rich context from library
      protocolSteps: [...],
      benefits: [...],
      guidelines: [...],
    }
  ],
  
  charityEnabled: false,
};
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Week 1: Activity Library
- [ ] Create `wellnessActivities` Firestore collection
- [ ] Define activity schema
- [ ] Create 60+ activity documents (use provided templates)
- [ ] Seed activities into Firestore
- [ ] Create `wellnessActivityService.ts`
- [ ] Test querying activities by category
- [ ] Test search functionality

### Week 2: Creation Form
- [ ] Create `CreateWellnessChallengeScreen.tsx`
- [ ] Implement basic form fields (name, description, dates)
- [ ] Add challenge type selector
- [ ] Calculate duration from dates
- [ ] Add image upload component
- [ ] Test form validation

### Week 3: Activity Selection
- [ ] Create `ActivityBrowserModal.tsx`
- [ ] Implement category filtering
- [ ] Add search functionality
- [ ] Create activity cards
- [ ] Test browsing experience

### Week 4: Activity Detail & Customization
- [ ] Create `ActivityDetailModal.tsx`
- [ ] Display protocol, benefits, guidelines, warnings
- [ ] Add customization inputs (target, unit, frequency)
- [ ] Implement "Add to Challenge" logic
- [ ] Show added activities in form
- [ ] Allow editing/removing activities

### Week 5: Challenge Creation
- [ ] Implement challenge creation logic
- [ ] Save challenge with activities to Firestore
- [ ] Test with multiple activities
- [ ] Verify all activity details preserved
- [ ] Test with charity toggle

### Week 6: Polish & Launch
- [ ] Mobile UI optimization (375px)
- [ ] Follow MOBILE_CONSTRAINTS.md
- [ ] Add loading states
- [ ] Add error handling
- [ ] User testing
- [ ] Documentation
- [ ] Launch to groups

---

## 🎯 SUCCESS CRITERIA

Challenge creation is successful when:
- [ ] User can browse 60+ wellness activities
- [ ] User can filter by category
- [ ] User can search activities
- [ ] User can view full activity details (protocol, benefits, etc.)
- [ ] User can customize targets for each activity
- [ ] User can add multiple activities to one challenge
- [ ] User can edit/remove activities before publishing
- [ ] Created challenge preserves all activity details
- [ ] Form matches fitness challenge UX
- [ ] UI follows mobile constraints (375px, proper spacing)
- [ ] All tap targets >= 44px

---

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Production Ready
