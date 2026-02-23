# TIIZI - TECHNICAL SPECIFICATION (CLEAN BUILD)

**Version:** 2.0 - Clean Build Edition  
**Date:** February 19, 2026  
**Status:** Production Ready - Greenfield Project

**🎯 PURPOSE:** Complete technical specification for building Tiizi fitness PWA from scratch. No previous code exists - this is a brand new project.

---

## 🏗️ PROJECT OVERVIEW

**What We're Building:**
A mobile-first Progressive Web App (PWA) for group fitness challenges with:
- 113-exercise catalog as the foundation
- Group fitness challenges
- Social features and leaderboards
- Real-time progress tracking
- Mobile-native experience (designed for 375px viewport)

**Tech Stack (Final):**
- ✅ React 18.3 + TypeScript
- ✅ Vite 5.x (build tool)
- ✅ Tailwind CSS 3.x (mobile-first)
- ✅ React Router v6
- ✅ React Query (TanStack Query) - data fetching
- ✅ Firebase (Auth, Firestore, Storage, Hosting)
- ✅ Lucide React (icons)

---

## 📐 ARCHITECTURE PRINCIPLES

### 1. Exercise-First Architecture
**Core Principle:** The exercise catalog is the single source of truth.
- All challenges are built from exercises
- All workouts are logged against exercises
- All progress is tracked per exercise
- Leaderboards aggregate exercise performance

### 2. Mobile-First Design
**Core Principle:** Design for 375px mobile screens first.
- Start at 375px viewport
- Build with touch interaction in mind
- Optimize for vertical scrolling
- Scale UP to tablet/desktop, not DOWN from desktop

### 3. Service Layer Pattern
**Core Principle:** Components never talk to Firestore directly.
- `exerciseService` owns all exercise data operations
- React Query hooks wrap the service
- Components only use hooks
- Easy to test, mock, and maintain

---

## 📂 PROJECT STRUCTURE

```
tiizi/
├── public/
│   └── manifest.json                 # PWA manifest
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Screen.tsx           # Screen wrapper
│   │   │   ├── Section.tsx          # Content section
│   │   │   └── index.ts
│   │   └── Mobile/
│   │       ├── Card.tsx             # Universal card
│   │       ├── ListItem.tsx         # List row pattern
│   │       ├── EmptyState.tsx       # Empty states
│   │       ├── LoadingSpinner.tsx   # Loading indicator
│   │       └── index.ts
│   ├── features/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SignupScreen.tsx
│   │   ├── Exercises/
│   │   │   ├── ExerciseLibraryScreen.tsx
│   │   │   └── ExerciseDetailScreen.tsx
│   │   ├── Challenges/
│   │   │   ├── ChallengesScreen.tsx
│   │   │   ├── ChallengeDetailScreen.tsx
│   │   │   └── CreateChallengeWizard.tsx
│   │   ├── Groups/
│   │   │   ├── GroupsScreen.tsx
│   │   │   ├── GroupDetailScreen.tsx
│   │   │   └── CreateGroupScreen.tsx
│   │   ├── Profile/
│   │   │   └── ProfileScreen.tsx
│   │   └── Home/
│   │       └── HomeScreen.tsx
│   ├── hooks/
│   │   ├── useExercises.ts          # Exercise data hooks
│   │   ├── useChallenges.ts         # Challenge data hooks
│   │   └── useAuth.ts               # Auth hooks
│   ├── services/
│   │   ├── exerciseService.ts       # Exercise data service
│   │   ├── challengeService.ts      # Challenge operations
│   │   └── groupService.ts          # Group operations
│   ├── lib/
│   │   └── firebase.ts              # Firebase config
│   ├── styles/
│   │   └── tokens.css               # Design tokens
│   ├── types/
│   │   └── index.ts                 # TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── scripts/
│   └── loadExercises.ts             # Load exercise catalog
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 🎨 DESIGN SYSTEM

### Design Tokens (`src/styles/tokens.css`)

```css
:root {
  /* Mobile-optimized spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;   /* Standard */
  --space-6: 24px;
  --space-8: 32px;
  
  /* Mobile-optimized typography */
  --text-xs: 10px;    /* Labels, badges */
  --text-sm: 12px;    /* Secondary text */
  --text-base: 14px;  /* Body text DEFAULT */
  --text-lg: 16px;    /* Emphasized text */
  --text-xl: 18px;    /* Section headings */
  --text-2xl: 20px;   /* Card titles */
  --text-3xl: 24px;   /* Screen titles */
  
  /* Colors */
  --primary: #ff6b00;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-500: #64748b;
  --slate-900: #0f172a;
  
  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;  /* Cards DEFAULT */
  --radius-lg: 16px;
  --radius-full: 9999px;
  
  /* Container */
  --container-max: 480px;
}
```

### Tailwind Configuration (`tailwind.config.js`)

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // OVERRIDE Tailwind defaults with mobile-first values
    fontSize: {
      'xs': 'var(--text-xs)',
      'sm': 'var(--text-sm)',
      'base': 'var(--text-base)',
      'lg': 'var(--text-lg)',
      'xl': 'var(--text-xl)',
      '2xl': 'var(--text-2xl)',
      '3xl': 'var(--text-3xl)',
    },
    spacing: {
      '0': 'var(--space-0)',
      '1': 'var(--space-1)',
      '2': 'var(--space-2)',
      '3': 'var(--space-3)',
      '4': 'var(--space-4)',
      '6': 'var(--space-6)',
      '8': 'var(--space-8)',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
        },
        slate: {
          50: 'var(--slate-50)',
          100: 'var(--slate-100)',
          500: 'var(--slate-500)',
          900: 'var(--slate-900)',
        },
      },
      maxWidth: {
        'mobile': 'var(--container-max)',
      },
    },
  },
}
```

---

## 🏗️ CORE ARCHITECTURE

### Exercise Service (`src/services/exerciseService.ts`)

**Purpose:** Single source of truth for all exercise data operations.

**Key Methods:**
```typescript
class ExerciseService {
  // Get all exercises with optional filters
  async getExercises(filters?: {
    tier1?: string;
    tier2?: string;
    difficulty?: string;
  }): Promise<CatalogExercise[]>
  
  // Get single exercise by ID
  async getExerciseById(id: string): Promise<CatalogExercise | null>
  
  // Batch fetch exercises by IDs
  async getExercisesByIds(ids: string[]): Promise<CatalogExercise[]>
  
  // Client-side search
  async searchExercises(term: string): Promise<CatalogExercise[]>
  
  // Get statistics
  async getExerciseStats(): Promise<Stats>
  
  // Get filter options
  async getFilterOptions(): Promise<FilterOptions>
}

export const exerciseService = new ExerciseService();
```

**Features:**
- Data validation at fetch time
- Centralized error handling
- Type-safe queries
- Optimized for React Query caching

### React Query Hooks (`src/hooks/useExercises.ts`)

**Purpose:** Clean API for components to access exercise data.

```typescript
// Get all/filtered exercises
export function useExercises(filters?: FilterOptions): UseQueryResult<CatalogExercise[], Error>

// Get single exercise
export function useExercise(id: string): UseQueryResult<CatalogExercise | null, Error>

// Search exercises
export function useExerciseSearch(term: string): UseQueryResult<CatalogExercise[], Error>

// Get statistics
export function useExerciseStats(): UseQueryResult<Stats, Error>

// Get filter options
export function useExerciseFilterOptions(): UseQueryResult<FilterOptions, Error>
```

**Caching Strategy:**
- Exercises: 5 min stale time
- Single exercise: 10 min stale time
- Search results: 2 min stale time
- Statistics: 30 min stale time

---

## 📱 COMPONENT LIBRARY

### Layout Components

#### Screen
Standard screen wrapper for all screens.

```tsx
import { Screen } from '@/components/Layout';

function MyScreen() {
  return (
    <Screen>
      {/* Content with automatic padding and bottom spacing */}
    </Screen>
  );
}
```

**Props:**
- `noPadding?: boolean` - Remove default padding
- `noBottomPadding?: boolean` - Remove bottom nav spacing
- `className?: string` - Additional classes

#### Section
Groups related content with optional title.

```tsx
import { Section } from '@/components/Layout';

function MyScreen() {
  return (
    <Section title="Recent Activity" action={<button>See All</button>}>
      <Card>Content 1</Card>
      <Card>Content 2</Card>
    </Section>
  );
}
```

**Props:**
- `title?: string` - Section heading
- `action?: ReactNode` - Action button
- `spacing?: 'tight' | 'normal' | 'loose'` - Vertical spacing

### Mobile Components

#### Card
Universal card component.

```tsx
import { Card } from '@/components/Mobile';

// Standard card (16px padding)
<Card>
  <h4>Title</h4>
  <p>Content</p>
</Card>

// Compact card (12px padding)
<Card variant="compact">
  <p>Tight content</p>
</Card>

// Flat card (0px padding, for lists)
<Card variant="flat">
  <ListItem title="Item 1" />
  <ListItem title="Item 2" />
</Card>

// Interactive card
<Card interactive onClick={() => navigate('/detail')}>
  <p>Clickable content</p>
</Card>
```

**Props:**
- `variant?: 'default' | 'compact' | 'flat'`
- `interactive?: boolean` - Add press animation
- `onClick?: () => void` - Click handler

#### ListItem
Mobile list row component.

```tsx
import { ListItem } from '@/components/Mobile';

// Basic
<ListItem title="Settings" />

// With subtitle
<ListItem title="Account" subtitle="Manage your profile" />

// With icon and value
<ListItem
  icon={<Settings size={18} />}
  title="Push-Ups"
  subtitle="Upper Body"
  value="12.5k"
  badge="reps"
  onClick={() => navigate('/exercise/push-ups')}
/>
```

**Props:**
- `icon?: ReactNode` - Left icon
- `title: string` - Main text (required)
- `subtitle?: string` - Secondary text
- `value?: string | number` - Right value
- `badge?: string` - Colored badge
- `chevron?: boolean` - Show chevron (default: true if onClick)
- `onClick?: () => void` - Click handler

#### EmptyState
Friendly empty state message.

```tsx
import { EmptyState } from '@/components/Mobile';
import { Search } from 'lucide-react';

<EmptyState
  icon={<Search size={48} />}
  title="No exercises found"
  message="Try adjusting your filters"
  action={
    <button onClick={handleReset}>Reset Filters</button>
  }
/>
```

#### LoadingSpinner
Consistent loading indicator.

```tsx
import { LoadingSpinner } from '@/components/Mobile';

// Full screen
if (isLoading) return <LoadingSpinner fullScreen />;

// With label
<LoadingSpinner label="Loading exercises..." />

// Small inline
<LoadingSpinner size="sm" />
```

---

## 🔥 FIREBASE SETUP

### Collections Structure

```
catalogExercises/           # 113 exercises (read-only)
  {exerciseId}/
    - id, name, tier_1, tier_2, difficulty
    - metric: { type, unit }
    - setup[], execution[], formCues[]
    - musclesTargeted[], equipment[]

users/                      # User profiles
  {userId}/
    - email, displayName, photoURL
    - createdAt, lastLoginAt
    - stats: { level, streak, totalWorkouts }

groups/                     # Fitness groups
  {groupId}/
    - name, description, coverImage
    - createdBy, createdAt
    - memberCount, challengeCount
    - members/                # Subcollection
        {userId}/
          - role, joinedAt

challenges/                 # Fitness challenges
  {challengeId}/
    - name, description, coverImage
    - type: 'collective' | 'competitive' | 'streak'
    - groupId, createdBy
    - startDate, endDate
    - activities[]          # Exercise snapshots
        - exerciseId, name, tier_1, tier_2
        - metricUnit, targetValue
    - participants/         # Subcollection
        {userId}/
          - progress, rank, lastWorkoutAt

workouts/                   # Logged workouts
  {workoutId}/
    - userId, challengeId, exerciseId
    - value, metricUnit
    - loggedAt, notes
```

### Security Rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Exercises - Read only
    match /catalogExercises/{exerciseId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Users - Own profile only
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
    
    // Groups - Members can read, creator can write
    match /groups/{groupId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && 
        resource.data.createdBy == request.auth.uid;
      
      match /members/{userId} {
        allow read: if isAuthenticated();
        allow write: if isAuthenticated();
      }
    }
    
    // Challenges - Group members can read, creator can write
    match /challenges/{challengeId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && 
        resource.data.createdBy == request.auth.uid;
      
      match /participants/{userId} {
        allow read: if isAuthenticated();
        allow write: if isOwner(userId);
      }
    }
    
    // Workouts - Own workouts only
    match /workouts/{workoutId} {
      allow read: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### Firestore Indexes (`firestore.indexes.json`)

```json
{
  "indexes": [
    {
      "collectionGroup": "catalogExercises",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tier_1", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "catalogExercises",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tier_1", "order": "ASCENDING" },
        { "fieldPath": "tier_2", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "workouts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "loggedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "challenges",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 🎯 BUILD SEQUENCE

### Phase 1: Project Setup (Day 1)

**1. Initialize Project**
```bash
npm create vite@latest tiizi -- --template react-ts
cd tiizi
npm install
```

**2. Install Dependencies**
```bash
# Core dependencies
npm install firebase react-router-dom @tanstack/react-query lucide-react

# Dev dependencies
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/node

# Initialize Tailwind
npx tailwindcss init -p
```

**3. Setup Firebase**
```bash
npm install -g firebase-tools
firebase login
firebase init

# Select:
# - Firestore
# - Hosting
# - Storage

# Create Firebase project in console first
# Then link: firebase use --add
```

**4. Create File Structure**
```bash
mkdir -p src/{components/{Layout,Mobile},features/{Auth,Exercises,Challenges,Groups,Profile,Home},hooks,services,lib,styles,types}
mkdir -p scripts
```

**5. Add Design Tokens**
- Create `src/styles/tokens.css` (use provided file)
- Update `src/index.css` to import tokens
- Update `tailwind.config.js` (use provided config)

**6. Configure TypeScript**
Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Phase 2: Foundation (Days 2-3)

**1. Firebase Configuration**
Create `src/lib/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

**2. TypeScript Types**
Create `src/types/index.ts`:
```typescript
export interface CatalogExercise {
  id: string;
  name: string;
  tier_1: 'Core' | 'Upper Body' | 'Lower Body' | 'Full Body';
  tier_2: 'Strength' | 'Cardio' | 'Balance & Stability' | 'Mobility & Flexibility' | 'Power & Explosiveness';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  metric: {
    type: 'reps' | 'time' | 'distance' | 'weight';
    unit: string;
  };
  description: string;
  setup: string[];
  execution: string[];
  formCues: string[];
  commonMistakes: string[];
  breathingPattern: string;
  musclesTargeted: string[];
  equipment: string[];
  progressions?: string[];
  regressions?: string[];
  safetyNotes: string[];
  recommendedVolume?: {
    beginner?: string;
    intermediate?: string;
    advanced?: string;
  };
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  stats: {
    level: number;
    streak: number;
    totalWorkouts: number;
  };
}

export interface Group {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  createdBy: string;
  createdAt: Date;
  memberCount: number;
  challengeCount: number;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  type: 'collective' | 'competitive' | 'streak';
  groupId: string;
  createdBy: string;
  startDate: Date;
  endDate: Date;
  activities: {
    activityId: string;
    order: number;
    exerciseId: string;
    exerciseName: string;
    tier_1: string;
    tier_2: string;
    metricUnit: string;
    targetValue: number;
  }[];
}
```

**3. Exercise Service**
- Copy `exerciseService.ts` to `src/services/`

**4. React Query Hooks**
- Copy `useExercises.ts` to `src/hooks/`

**5. Component Library**
- Copy all component files to respective folders:
  - `Screen.tsx`, `Section.tsx` → `src/components/Layout/`
  - `Card.tsx`, `ListItem.tsx`, `EmptyState.tsx`, `LoadingSpinner.tsx` → `src/components/Mobile/`
  - Create index files for clean imports

### Phase 3: Core Screens (Days 4-7)

**Build screens in this order:**

**1. Authentication (Day 4)**
- `LoginScreen.tsx`
- `SignupScreen.tsx`
- Use Firebase Auth with email/password

**2. Exercise Library (Day 5)**
- `ExerciseLibraryScreen.tsx` - List all exercises with filters
- `ExerciseDetailScreen.tsx` - Show full exercise details
- Use `useExercises` hook

**3. Home Screen (Day 6)**
- `HomeScreen.tsx` - Dashboard with active challenges, daily goals
- Use React Query for real-time data

**4. Profile Screen (Day 6)**
- `ProfileScreen.tsx` - User stats, settings, logout

**5. Groups Screen (Day 7)**
- `GroupsScreen.tsx` - List user's groups
- `GroupDetailScreen.tsx` - Group members and challenges
- `CreateGroupScreen.tsx` - Create new group

**6. Challenges Screen (Day 7)**
- `ChallengesScreen.tsx` - Browse and join challenges
- `ChallengeDetailScreen.tsx` - Challenge progress and leaderboard
- `CreateChallengeWizard.tsx` - Multi-step challenge creation

### Phase 4: Data Loading (Day 8)

**1. Load Exercise Catalog**
Create `scripts/loadExercises.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import exercisesData from '../catalogExercises_CLEAN.json';

// Use your Firebase config
const app = initializeApp({ /* config */ });
const db = getFirestore(app);

async function loadExercises() {
  console.log(`Loading ${exercisesData.documents.length} exercises...`);
  
  for (const exercise of exercisesData.documents) {
    await setDoc(doc(collection(db, 'catalogExercises'), exercise.id), exercise);
    console.log(`Loaded: ${exercise.name}`);
  }
  
  console.log('✅ All exercises loaded!');
}

loadExercises().catch(console.error);
```

**2. Run Script**
```bash
npx tsx scripts/loadExercises.ts
```

### Phase 5: Routing & Navigation (Day 9)

**Setup React Router**
Create `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Screens
import LoginScreen from './features/Auth/LoginScreen';
import HomeScreen from './features/Home/HomeScreen';
import ExerciseLibraryScreen from './features/Exercises/ExerciseLibraryScreen';
import ExerciseDetailScreen from './features/Exercises/ExerciseDetailScreen';
import GroupsScreen from './features/Groups/GroupsScreen';
import ChallengesScreen from './features/Challenges/ChallengesScreen';
import ProfileScreen from './features/Profile/ProfileScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/exercises" element={<ExerciseLibraryScreen />} />
          <Route path="/exercises/:id" element={<ExerciseDetailScreen />} />
          <Route path="/groups" element={<GroupsScreen />} />
          <Route path="/challenges" element={<ChallengesScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

### Phase 6: Testing & Deployment (Days 10-14)

**1. Local Testing**
```bash
npm run dev
# Test at http://localhost:5173
```

**2. Build for Production**
```bash
npm run build
```

**3. Deploy to Firebase**
```bash
firebase deploy
```

**4. Deploy Firestore Rules & Indexes**
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## ✅ SUCCESS CRITERIA

### Functionality
- ✅ User can sign up, log in, log out
- ✅ User can browse 113 exercises with filters
- ✅ User can view exercise details
- ✅ User can create and join groups
- ✅ User can create and join challenges
- ✅ User can log workouts
- ✅ Real-time leaderboards work
- ✅ Progress tracking accurate

### Mobile Performance
- ✅ No horizontal scroll at 375px width
- ✅ All tap targets >= 44px
- ✅ Load time < 3 seconds
- ✅ Lighthouse score >= 90
- ✅ Works offline (PWA)

### Code Quality
- ✅ All components use design tokens
- ✅ Consistent component patterns
- ✅ No direct Firestore queries in components
- ✅ TypeScript strict mode enabled
- ✅ No console errors

### Design System
- ✅ All screens use Screen wrapper
- ✅ All sections use Section component
- ✅ All cards use Card component
- ✅ All list items use ListItem component
- ✅ Design tokens followed throughout

---

## 📚 REFERENCE FILES

All implementation files are provided:

**Service Layer:**
- `exerciseService.ts` - Complete implementation
- `useExercises.ts` - React Query hooks

**Design System:**
- `tokens.css` - Design tokens
- `Card.tsx`, `ListItem.tsx`, `Screen.tsx`, `Section.tsx`, `EmptyState.tsx`, `LoadingSpinner.tsx`

**Data:**
- `catalogExercises_CLEAN.json` - 113 unique exercises

**Documentation:**
- `COMPONENT_LIBRARY_README.md` - Component usage guide

---

## 🚨 COMMON PITFALLS TO AVOID

❌ **Don't:**
- Query Firestore directly from components
- Create custom cards/lists (use component library)
- Use Tailwind default font sizes (use our mobile-first scale)
- Use `gray-*` colors (use `slate-*`)
- Design at desktop size first
- Create magic number spacing values

✅ **Do:**
- Use `exerciseService` through hooks only
- Use Card, ListItem components everywhere
- Use mobile-optimized font scale
- Use slate color palette
- Design at 375px first
- Use design token spacing (4px, 8px, 12px, 16px, 24px)

---

**Document Version:** 2.0 - Clean Build Edition  
**Last Updated:** February 19, 2026

This specification is for building Tiizi from scratch. No previous code exists.
