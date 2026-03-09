# 🤖 CODING AGENT PROMPTS - WELLNESS CHALLENGE IMPLEMENTATION

**Step-by-step prompts to implement the two-stage wellness challenge system**

---

## 📋 OVERVIEW

These prompts guide your coding agent to build:
1. **Activity Library** - Pre-built wellness activities in Firestore
2. **Challenge Creation Form** - Custom form to compose challenges from activities

Use these prompts in order. Each builds on the previous.

---

## 🚀 PHASE 1: SETUP ACTIVITY LIBRARY

### PROMPT 1.1: Create Activity Schema

```
Create the wellness activity data schema following the fitness challenge pattern.

REQUIREMENTS:
1. Create TypeScript interface for WellnessActivity
2. Must include:
   - Basic info (id, name, description, category, difficulty)
   - Activity type (fasting, water, sleep, meditation, etc.)
   - Default targets (metricUnit, targetValue, frequency)
   - Protocol details (steps, fastingProtocol, hydrationProtocol, sleepProtocol)
   - Rich context (benefits, guidelines, warnings, contraindications)
   - Points & gamification
   - Metadata (popular, medicalSupervisionRequired, tags)

SCHEMA REFERENCE:
```typescript
interface WellnessActivity {
  id: string;
  category: 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social';
  name: string;
  shortName: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  icon: string;
  coverImage?: string;
  
  activityType: 'fasting' | 'water' | 'sleep' | 'meditation' | 'food' | 'habit' | 'breathing' | 'social';
  
  defaultMetricUnit: string;
  defaultTargetValue: number;
  suggestedFrequency: number;
  
  protocolSteps?: string[];
  fastingProtocol?: {
    fastingHours: number;
    eatingHours: number;
    startTime?: string;
    endTime?: string;
  };
  // ... other protocols
  
  benefits: string[];
  benefitsTimeline?: {
    week1: string[];
    week2: string[];
    week3plus: string[];
  };
  guidelines: string[];
  warnings?: string[];
  contraindications?: string[];
  
  bodyResponse?: {
    timeRange: string;
    title: string;
    description: string;
    effects: string[];
  }[];
  
  defaultPoints: number;
  bonusConditions?: {
    condition: string;
    points: number;
  }[];
  
  popular: boolean;
  medicalSupervisionRequired: boolean;
  prerequisite?: string;
  tags: string[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

CREATE FILE: src/types/wellnessActivity.ts
EXPORT interface and helper types.
```

---

### PROMPT 1.2: Create Activity Service

```
Create service to interact with wellness activities library in Firestore.

REQUIREMENTS:
1. Create src/services/wellnessActivityService.ts
2. Implement methods:
   - getAllActivities(): Get all activities
   - getActivitiesByCategory(category): Filter by category
   - searchActivities(searchTerm): Search by name/description/tags
   - getPopularActivities(limit): Get featured activities
   - getActivityById(id): Get single activity details

3. Use Firestore queries (collection, query, where, orderBy)
4. Return typed WellnessActivity objects
5. Handle errors gracefully

EXAMPLE IMPLEMENTATION:
```typescript
// src/services/wellnessActivityService.ts
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WellnessActivity } from '../types/wellnessActivity';

export const wellnessActivityService = {
  async getAllActivities(): Promise<WellnessActivity[]> {
    const q = query(
      collection(db, 'wellnessActivities'),
      orderBy('category'),
      orderBy('difficulty')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WellnessActivity));
  },
  
  async getActivitiesByCategory(category: string): Promise<WellnessActivity[]> {
    const q = query(
      collection(db, 'wellnessActivities'),
      where('category', '==', category),
      orderBy('difficulty')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WellnessActivity));
  },
  
  async searchActivities(searchTerm: string): Promise<WellnessActivity[]> {
    // Get all and filter (for production, use Algolia)
    const all = await this.getAllActivities();
    const term = searchTerm.toLowerCase();
    return all.filter(activity =>
      activity.name.toLowerCase().includes(term) ||
      activity.description.toLowerCase().includes(term) ||
      activity.tags?.some(tag => tag.toLowerCase().includes(term))
    );
  },
  
  async getPopularActivities(maxResults: number = 10): Promise<WellnessActivity[]> {
    const q = query(
      collection(db, 'wellnessActivities'),
      where('popular', '==', true),
      limit(maxResults)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WellnessActivity));
  },
  
  async getActivityById(id: string): Promise<WellnessActivity | null> {
    const docSnap = await getDoc(doc(db, 'wellnessActivities', id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as WellnessActivity;
  },
};
```

IMPLEMENT THIS SERVICE.
TEST with console.log to verify queries work.
```

---

### PROMPT 1.3: Seed Sample Activities

```
Create seed script to populate Firestore with wellness activities.

REQUIREMENTS:
1. Create scripts/seedWellnessActivities.ts
2. Import sample activities from wellness-templates-sample.json
3. Transform JSON templates into WellnessActivity format
4. Upload to Firestore wellnessActivities collection
5. Add popular flag to beginner activities
6. Add timestamps

SAMPLE ACTIVITIES TO SEED:
1. Fasting: 16-Hour Fast (beginner)
2. Hydration: Daily 2L (beginner)
3. Sleep: 8-Hour Streak (beginner)
4. Mindfulness: 5-Min Meditation (beginner)
5. Nutrition: 5-a-Day Vegetables (beginner)
6. Habits: Morning Routine (beginner)
7. Stress: Deep Breathing 3x (beginner)
8. Social: Daily Connection (beginner)

IMPLEMENTATION:
```typescript
// scripts/seedWellnessActivities.ts
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

const sampleActivities: WellnessActivity[] = [
  {
    id: 'fasting-16hr',
    category: 'fasting',
    name: '16-Hour Daily Fast (Beginner Friendly)',
    shortName: '16hr Fast',
    description: 'Fast for 16 hours, eat within 8-hour window. Perfect for beginners.',
    difficulty: 'beginner',
    icon: '🕐',
    activityType: 'fasting',
    defaultMetricUnit: 'hours',
    defaultTargetValue: 16,
    suggestedFrequency: 1,
    protocolSteps: [
      'Stop eating by 8:00 PM',
      'Sleep through most of the fast',
      'Break fast at 12:00 PM the next day',
      'Stay hydrated with water, coffee, tea'
    ],
    fastingProtocol: {
      fastingHours: 16,
      eatingHours: 8,
      startTime: '20:00',
      endTime: '12:00'
    },
    benefits: [
      'Improved mental clarity',
      'Weight loss (0.5-1kg/week)',
      'Better insulin sensitivity',
      'Reduced inflammation'
    ],
    guidelines: [
      'Stay well-hydrated',
      'Break fast if feeling unwell',
      'Focus on nutritious foods'
    ],
    warnings: [
      'Not for pregnant/breastfeeding women',
      'Consult doctor if on medications'
    ],
    defaultPoints: 10,
    bonusConditions: [
      { condition: '7-day streak', points: 50 },
      { condition: '14-day streak', points: 100 }
    ],
    popular: true,
    medicalSupervisionRequired: false,
    tags: ['fasting', 'intermittent fasting', '16/8', 'weight loss', 'beginner'],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  // Add 7 more activities...
];

async function seed() {
  for (const activity of sampleActivities) {
    await setDoc(doc(db, 'wellnessActivities', activity.id), activity);
    console.log(`✓ Seeded: ${activity.name}`);
  }
  console.log('✓ All activities seeded');
}

seed();
```

RUN SCRIPT: npm run seed:wellness-activities
VERIFY: Check Firebase console for wellnessActivities collection
```

---

## 🎨 PHASE 2: BUILD ACTIVITY BROWSER

### PROMPT 2.1: Create Activity Browser Modal

```
Create modal component to browse and search wellness activities.

REQUIREMENTS:
1. Create src/components/Wellness/ActivityBrowserModal.tsx
2. Features:
   - Full-screen modal
   - Search input at top
   - Category filter tabs (All, Fasting, Hydration, Sleep, etc.)
   - Activity cards list (scrollable)
   - Each card shows: icon, name, difficulty, description
   - Tap card to view details
3. Use wellnessActivityService for data
4. Loading states
5. Empty states

UI CONSTRAINTS:
- Follow MOBILE_CONSTRAINTS.md
- Modal full-screen
- Search bar: h-11, rounded-lg
- Category tabs: h-9, horizontal scroll, gap-2
- Activity cards: Card component, gap-3 between cards
- All text: text-xs through text-2xl only

COMPONENT STRUCTURE:
```tsx
// src/components/Wellness/ActivityBrowserModal.tsx
import { useState, useEffect } from 'react';
import { Modal, SearchInput, ScrollableTabBar, Card, LoadingSpinner } from '@/components';
import { wellnessActivityService } from '@/services/wellnessActivityService';

interface Props {
  onClose: () => void;
  onSelectActivity: (activity: WellnessActivity) => void;
}

export function ActivityBrowserModal({ onClose, onSelectActivity }: Props) {
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
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button onClick={onClose}>← Back</button>
        <h2 className="text-xl font-bold">Add Wellness Activity</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>
      
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
        <Tab active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>
          All
        </Tab>
        <Tab active={selectedCategory === 'fasting'} onClick={() => setSelectedCategory('fasting')}>
          Fasting
        </Tab>
        <Tab active={selectedCategory === 'hydration'} onClick={() => setSelectedCategory('hydration')}>
          Hydration
        </Tab>
        {/* More tabs... */}
      </ScrollableTabBar>
      
      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingSpinner />
        ) : activities.length === 0 ? (
          <EmptyState message="No activities found" />
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
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <span className="text-2xl">{activity.icon}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold">{activity.name}</h3>
          <p className="text-sm text-slate-600 line-clamp-2">{activity.description}</p>
          <div className="flex gap-2 mt-2 text-xs text-slate-500">
            <span className="capitalize">{activity.difficulty}</span>
            <span>•</span>
            <span>{activity.defaultTargetValue} {activity.defaultMetricUnit}</span>
          </div>
        </div>
        <ChevronRight size={20} />
      </div>
    </Card>
  );
}
```

IMPLEMENT THIS COMPONENT.
TEST: Should show all activities, filter by category, search.
```

---

### PROMPT 2.2: Create Activity Detail Modal

```
Create modal to show full activity details with customization options.

REQUIREMENTS:
1. Create src/components/Wellness/ActivityDetailModal.tsx
2. Display:
   - Hero section (icon, name, description, difficulty badges)
   - Protocol details (steps)
   - Benefits list (with checkmarks)
   - Guidelines list (with info icons)
   - Warnings (if any, in red card)
   - Customization form:
     * Target Value (number input)
     * Metric Unit (select)
     * Frequency (select: daily, 3x-week, weekly)
     * Points per completion (number input)
3. "Add to Challenge" button at bottom (fixed)
4. Scroll view for content
5. Follow mobile constraints

COMPONENT:
```tsx
// src/components/Wellness/ActivityDetailModal.tsx
import { useState } from 'react';
import { Modal, Section, Card, Badge, Input, Select, Button } from '@/components';
import { Check, AlertCircle, AlertTriangle, ChevronLeft } from 'lucide-react';

interface Props {
  activity: WellnessActivity;
  onClose: () => void;
  onAdd: (activity: WellnessActivity, customization: Customization) => void;
}

interface Customization {
  targetValue: number;
  metricUnit: string;
  frequency: string;
  pointsPerCompletion: number;
}

export function ActivityDetailModal({ activity, onClose, onAdd }: Props) {
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
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold flex-1">Activity Detail</h2>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{activity.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase text-primary">{activity.category}</p>
              <h1 className="text-2xl font-bold">{activity.name}</h1>
            </div>
          </div>
          <p className="text-base text-slate-600 mb-3">{activity.description}</p>
          <div className="flex gap-2">
            <Badge>{activity.difficulty}</Badge>
            <Badge>{activity.defaultTargetValue} {activity.defaultMetricUnit}</Badge>
            <Badge>{activity.activityType}</Badge>
          </div>
        </div>
        
        {/* Protocol */}
        {activity.protocolSteps && (
          <Section title="Protocol Details">
            <Card className="bg-slate-50">
              {activity.protocolSteps.map((step, i) => (
                <div key={i} className="flex gap-3 mb-3 last:mb-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </Card>
          </Section>
        )}
        
        {/* Benefits */}
        <Section title="Benefits">
          <Card variant="flat">
            {activity.benefits.map((benefit, i) => (
              <div key={i} className="flex gap-3 mb-3 last:mb-0">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <Check size={14} className="text-green-600" />
                </div>
                <p className="text-sm">{benefit}</p>
              </div>
            ))}
          </Card>
        </Section>
        
        {/* Guidelines */}
        <Section title="Guidelines">
          <Card variant="flat">
            {activity.guidelines.map((guideline, i) => (
              <div key={i} className="flex gap-3 mb-3 last:mb-0">
                <AlertCircle size={20} className="text-primary" />
                <p className="text-sm">{guideline}</p>
              </div>
            ))}
          </Card>
        </Section>
        
        {/* Warnings */}
        {activity.warnings && activity.warnings.length > 0 && (
          <Section title="Important Warnings">
            <Card className="bg-red-50 border-2 border-red-200">
              {activity.warnings.map((warning, i) => (
                <div key={i} className="flex gap-3 mb-3 last:mb-0">
                  <AlertTriangle size={20} className="text-red-600" />
                  <p className="text-sm text-red-900">{warning}</p>
                </div>
              ))}
            </Card>
          </Section>
        )}
        
        {/* Customize */}
        <Section title="Customize Targets">
          <Card>
            <div className="space-y-4">
              <Input
                label="Target Value"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
              />
              <Select
                label="Metric Unit"
                value={metricUnit}
                onChange={(e) => setMetricUnit(e.target.value)}
              >
                <option value={activity.defaultMetricUnit}>{activity.defaultMetricUnit}</option>
              </Select>
              <Select
                label="Frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="3x-week">3x per week</option>
                <option value="weekly">Weekly</option>
              </Select>
              <Input
                label="Points per Completion"
                type="number"
                value={pointsPerCompletion}
                onChange={(e) => setPointsPerCompletion(Number(e.target.value))}
              />
            </div>
          </Card>
        </Section>
      </div>
      
      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white border-t">
        <Button primary fullWidth onClick={handleAdd}>
          Add to Challenge
        </Button>
      </div>
    </Modal>
  );
}
```

IMPLEMENT THIS.
TEST: Should display all activity details, allow customization.
```

---

## 📝 PHASE 3: BUILD CREATION FORM

### PROMPT 3.1: Create Challenge Creation Screen

```
Create wellness challenge creation form matching the fitness challenge UX.

REQUIREMENTS:
1. Create src/features/Challenges/CreateWellnessChallengeScreen.tsx
2. Form fields:
   - Cover image upload
   - Challenge name (text input)
   - Challenge description (textarea)
   - Challenge type (collective/competitive/streak pills)
   - Start date & end date (date inputs)
   - Duration (auto-calculated, read-only display)
   - Activities list (added from library)
   - Charity toggle + fields (optional)
3. "Launch Challenge" button
4. Integrate ActivityBrowserModal and ActivityDetailModal
5. Store selected activities in state
6. Allow editing/removing activities
7. Save challenge to Firestore on submit

REFERENCE: Use code.html (fitness challenge form) as UI template

IMPLEMENTATION:
```tsx
// src/features/Challenges/CreateWellnessChallengeScreen.tsx
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Screen, Section, Input, Textarea, DateInput, Button } from '@/components';
import { ActivityBrowserModal, ActivityDetailModal } from '@/components/Wellness';

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
  const [showBrowser, setShowBrowser] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<WellnessActivity | null>(null);
  
  // Calculate duration
  const duration = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);
  
  // Add activity
  const handleAddActivity = (
    activity: WellnessActivity,
    customization: Customization
  ) => {
    const customizedActivity = {
      activityId: activity.id,
      order: activities.length + 1,
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
      targetValue: customization.targetValue,
      metricUnit: customization.metricUnit,
      frequency: customization.frequency,
      pointsPerCompletion: customization.pointsPerCompletion,
      bonusPoints: activity.bonusConditions,
    };
    
    setActivities([...activities, customizedActivity]);
    setShowDetail(false);
    setShowBrowser(false);
  };
  
  // Create challenge
  const handleCreate = async () => {
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
      {/* Form UI matching code.html */}
      {/* ... implement form fields ... */}
      
      {/* Activities Section */}
      <Section title="Challenge Activities">
        <Card variant="flat">
          {activities.map((activity, i) => (
            <ActivityListItem
              key={i}
              activity={activity}
              onEdit={() => editActivity(i)}
              onRemove={() => removeActivity(i)}
            />
          ))}
          <Button
            variant="outline"
            fullWidth
            onClick={() => setShowBrowser(true)}
          >
            + Add Activity from Library
          </Button>
        </Card>
      </Section>
      
      {/* Modals */}
      {showBrowser && (
        <ActivityBrowserModal
          onClose={() => setShowBrowser(false)}
          onSelectActivity={(activity) => {
            setSelectedActivity(activity);
            setShowBrowser(false);
            setShowDetail(true);
          }}
        />
      )}
      
      {showDetail && selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setShowDetail(false)}
          onAdd={handleAddActivity}
        />
      )}
    </Screen>
  );
}
```

IMPLEMENT THIS FORM.
MATCH UI FROM code.html (fitness challenge).
FOLLOW MOBILE_CONSTRAINTS.md.
```

---

## ✅ TESTING & VALIDATION

### PROMPT 4.1: Test Complete Flow

```
Test the complete wellness challenge creation flow end-to-end.

TEST CASES:
1. Browse activities
   - [ ] Can see all 8 seeded activities
   - [ ] Can filter by category (fasting, hydration, etc.)
   - [ ] Can search activities by name
   
2. View activity details
   - [ ] Shows protocol steps
   - [ ] Shows benefits list
   - [ ] Shows guidelines
   - [ ] Shows warnings (if any)
   - [ ] Can customize target value
   - [ ] Can customize frequency
   
3. Add activity to challenge
   - [ ] Activity appears in form
   - [ ] Shows customized values
   - [ ] Can add multiple activities
   - [ ] Can remove activities
   
4. Create challenge
   - [ ] Name and description required
   - [ ] Dates required (duration auto-calculated)
   - [ ] At least 1 activity required
   - [ ] Creates document in Firestore
   - [ ] Preserves all activity details
   - [ ] Navigates to challenge detail
   
5. Mobile UI
   - [ ] All screens work at 375px
   - [ ] No horizontal scroll
   - [ ] All tap targets >= 44px
   - [ ] Proper spacing (p-3, p-4, p-6, gap-2, gap-3)
   - [ ] Proper text sizes (text-xs through text-3xl)

PERFORM THESE TESTS.
FIX any issues found.
PROVIDE TEST RESULTS.
```

---

## 📚 SUMMARY

Use these prompts in this order:

1. **PROMPT 1.1** - Create activity schema
2. **PROMPT 1.2** - Create activity service
3. **PROMPT 1.3** - Seed sample activities
4. **PROMPT 2.1** - Create activity browser modal
5. **PROMPT 2.2** - Create activity detail modal
6. **PROMPT 3.1** - Create challenge creation form
7. **PROMPT 4.1** - Test complete flow

After completing all prompts, you'll have:
- ✅ Activity library in Firestore
- ✅ Activity browsing & search
- ✅ Activity detail view with customization
- ✅ Challenge creation form
- ✅ Full integration working

---

**Version:** 1.0  
**Target Completion:** 1 week  
**Estimated Hours:** 20-30 hours
