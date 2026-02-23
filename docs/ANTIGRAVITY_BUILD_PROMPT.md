# 🚀 TIIZI FITNESS PWA - ANTIGRAVITY IDE BUILD PROMPT

**Project Type:** Complete PWA (Progressive Web App) from scratch  
**Framework:** React 18 + TypeScript + Vite  
**Backend:** Firebase (Firestore, Auth, Hosting, Storage)  
**Styling:** Tailwind CSS (mobile-first)

---

## 📋 PROJECT REQUIREMENTS

**What to Build:**
A mobile-first fitness Progressive Web App with:
1. 113-exercise catalog (foundation of entire app)
2. User authentication (Firebase Auth)
3. Group fitness challenges
4. Social features and leaderboards
5. Workout logging and progress tracking
6. Mobile-native UI (designed for 375px viewport)

**Tech Stack:**
- React 18.3 + TypeScript 5.x
- Vite 5.x (build tool)
- Tailwind CSS 3.x (mobile-first configuration)
- React Router v6 (client-side routing)
- TanStack Query / React Query (data fetching & caching)
- Firebase SDK (Auth, Firestore, Storage, Hosting)
- Lucide React (icon library)

---

## 🎯 CRITICAL ARCHITECTURE REQUIREMENTS

### 1. **Exercise-First Architecture**
- Exercise catalog is the SINGLE SOURCE OF TRUTH
- All challenges are built FROM exercises
- All workouts are logged AGAINST exercises
- No direct Firestore queries from components
- Must use service layer pattern

### 2. **Mobile-First Design**
- Design for 375px viewport FIRST (not scaled down from desktop)
- All components must be touch-friendly (44px minimum tap targets)
- Use design token system (no magic numbers)
- No horizontal scroll at any mobile viewport

### 3. **Service Layer Pattern**
- Components NEVER talk to Firestore directly
- `exerciseService` owns all exercise operations
- React Query hooks wrap all services
- Components only use hooks

---

## 📂 EXACT PROJECT STRUCTURE

```
tiizi/
├── public/
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Screen.tsx
│   │   │   ├── Section.tsx
│   │   │   └── index.ts
│   │   └── Mobile/
│   │       ├── Card.tsx
│   │       ├── ListItem.tsx
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSpinner.tsx
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
│   │   ├── useExercises.ts
│   │   ├── useChallenges.ts
│   │   └── useAuth.ts
│   ├── services/
│   │   ├── exerciseService.ts
│   │   ├── challengeService.ts
│   │   └── groupService.ts
│   ├── lib/
│   │   └── firebase.ts
│   ├── styles/
│   │   └── tokens.css
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── scripts/
│   └── loadExercises.ts
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 🎨 DESIGN SYSTEM (MUST USE EXACTLY)

### Design Tokens (`src/styles/tokens.css`)

```css
:root {
  /* Mobile-optimized spacing - NEVER use other values */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;   /* Standard padding */
  --space-6: 24px;
  --space-8: 32px;
  
  /* Mobile-optimized typography - OVERRIDE Tailwind defaults */
  --text-xs: 10px;    /* Labels, badges, timestamps */
  --text-sm: 12px;    /* Secondary text, captions */
  --text-base: 14px;  /* Body text (DEFAULT) */
  --text-lg: 16px;    /* Emphasized text */
  --text-xl: 18px;    /* Section headings */
  --text-2xl: 20px;   /* Card titles */
  --text-3xl: 24px;   /* Screen titles */
  
  /* Colors - Use slate NOT gray */
  --primary: #ff6b00;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-500: #64748b;
  --slate-900: #0f172a;
  
  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;  /* Cards */
  --radius-lg: 16px;
  --radius-full: 9999px;
  
  /* Container */
  --container-max: 480px;
}
```

### Tailwind Config (`tailwind.config.js`)

**CRITICAL:** This config OVERRIDES Tailwind defaults with mobile-first values.

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // OVERRIDE defaults - do NOT use extend here
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
      '0': '0',
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

## 🏗️ STEP-BY-STEP BUILD INSTRUCTIONS

### STEP 1: Project Initialization

```bash
# Create Vite project
npm create vite@latest tiizi -- --template react-ts
cd tiizi
npm install

# Install ALL dependencies
npm install firebase react-router-dom @tanstack/react-query lucide-react
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p

# Setup Firebase CLI
npm install -g firebase-tools
firebase login
firebase init
# Select: Firestore, Hosting, Storage
```

### STEP 2: Create File Structure

```bash
# Create all directories
mkdir -p src/components/Layout src/components/Mobile
mkdir -p src/features/Auth src/features/Exercises src/features/Challenges
mkdir -p src/features/Groups src/features/Profile src/features/Home
mkdir -p src/hooks src/services src/lib src/styles src/types
mkdir -p scripts
```

### STEP 3: Setup Design System

**1. Create `src/styles/tokens.css`** (copy from provided file)

**2. Update `src/index.css`:**
```css
@import './styles/tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Global mobile styles */
html {
  font-size: 16px; /* NEVER change */
}

body {
  margin: 0;
  padding: 0;
  overflow-x: hidden; /* Prevent horizontal scroll */
}

#root {
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Prevent iOS zoom on input focus */
input, textarea, select {
  font-size: 16px !important;
}

/* Responsive container */
@media (min-width: 768px) {
  #root {
    max-width: var(--container-max);
    margin: 0 auto;
    box-shadow: 0 0 50px rgba(0,0,0,0.1);
  }
  body {
    background: var(--slate-100);
  }
}
```

**3. Update `tailwind.config.js`** (copy from provided config)

**4. Update `tsconfig.json`:**
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
  },
  "include": ["src"]
}
```

### STEP 4: Setup Firebase

**1. Create `src/lib/firebase.ts`:**
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

**2. Create `.env` file:**
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### STEP 5: Create TypeScript Types

**Create `src/types/index.ts`:** (See provided file for complete types)

Must include:
- `CatalogExercise` interface (complete exercise schema)
- `User` interface
- `Group` interface
- `Challenge` interface
- `Workout` interface

### STEP 6: Build Service Layer

**1. Create `src/services/exerciseService.ts`**

**CRITICAL:** Copy the EXACT implementation from the provided `exerciseService.ts` file.

Key methods required:
- `getExercises(filters?)` - Get all/filtered exercises
- `getExerciseById(id)` - Get single exercise
- `getExercisesByIds(ids[])` - Batch fetch
- `searchExercises(term)` - Client-side search
- `getExerciseStats()` - Statistics
- `getFilterOptions()` - Available filter values

**2. Create `src/hooks/useExercises.ts`**

**CRITICAL:** Copy the EXACT implementation from the provided `useExercises.ts` file.

Required hooks:
- `useExercises(filters?)` - Main query hook
- `useExercise(id)` - Single exercise hook
- `useExerciseSearch(term)` - Search hook
- `useExerciseStats()` - Stats hook
- `useExerciseFilterOptions()` - Filter options hook

### STEP 7: Build Component Library

Copy ALL these files EXACTLY as provided:

**Layout Components:**
- `src/components/Layout/Screen.tsx`
- `src/components/Layout/Section.tsx`
- `src/components/Layout/index.ts`

**Mobile Components:**
- `src/components/Mobile/Card.tsx`
- `src/components/Mobile/ListItem.tsx`
- `src/components/Mobile/EmptyState.tsx`
- `src/components/Mobile/LoadingSpinner.tsx`
- `src/components/Mobile/index.ts`

**CRITICAL:** Do NOT modify these components. Use them as-is.

### STEP 8: Build Core Screens

**Build screens in this EXACT order:**

**1. Exercise Library Screen** (`src/features/Exercises/ExerciseLibraryScreen.tsx`)

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExercises, useExerciseSearch } from '../../hooks/useExercises';
import { Screen, Section } from '../../components/Layout';
import { Card, ListItem, EmptyState, LoadingSpinner } from '../../components/Mobile';
import { Search, Dumbbell } from 'lucide-react';

function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ tier1: 'All', difficulty: 'All' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use search hook if searching, otherwise use filter hook
  const { data: exercises, isLoading, error } = searchTerm.length >= 2
    ? useExerciseSearch(searchTerm)
    : useExercises(filters.tier1 !== 'All' || filters.difficulty !== 'All' ? filters : undefined);
  
  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error) return <EmptyState icon={<Search size={48} />} title="Error loading exercises" />;
  if (!exercises || exercises.length === 0) {
    return <EmptyState icon={<Search size={48} />} title="No exercises found" />;
  }
  
  return (
    <Screen>
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 bg-slate-50 rounded-xl px-4 text-sm"
        />
      </div>
      
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['All', 'Core', 'Upper Body', 'Lower Body', 'Full Body'].map(tier => (
          <button
            key={tier}
            onClick={() => setFilters({ ...filters, tier1: tier })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              filters.tier1 === tier ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {tier}
          </button>
        ))}
      </div>
      
      {/* Exercise List */}
      <Section title="Exercises" spacing="normal">
        <div className="space-y-3">
          {exercises.map(exercise => (
            <Card key={exercise.id} interactive onClick={() => navigate(`/exercises/${exercise.id}`)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Dumbbell size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{exercise.name}</p>
                  <p className="text-xs text-slate-500 truncate">{exercise.tier_2} • {exercise.difficulty}</p>
                </div>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                  {exercise.metric.unit}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </Screen>
  );
}

export default ExerciseLibraryScreen;
```

**2. Exercise Detail Screen** (`src/features/Exercises/ExerciseDetailScreen.tsx`)

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useExercise } from '../../hooks/useExercises';
import { Screen, Section } from '../../components/Layout';
import { Card, EmptyState, LoadingSpinner } from '../../components/Mobile';
import { ArrowLeft, Dumbbell } from 'lucide-react';

function ExerciseDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: exercise, isLoading, error } = useExercise(id);
  
  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error || !exercise) {
    return <EmptyState icon={<Dumbbell size={48} />} title="Exercise not found" />;
  }
  
  return (
    <Screen noPadding>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 py-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">Back</span>
        </button>
      </div>
      
      <div className="px-4 py-4 space-y-4">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-black">{exercise.name}</h1>
          <div className="flex gap-2 mt-3">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
              {exercise.tier_1}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
              {exercise.tier_2}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
              {exercise.difficulty}
            </span>
          </div>
        </div>
        
        {/* Description */}
        <Card>
          <p className="text-sm text-slate-700">{exercise.description}</p>
        </Card>
        
        {/* Setup */}
        {exercise.setup && exercise.setup.length > 0 && (
          <Section title="Setup">
            <Card>
              <ol className="space-y-2">
                {exercise.setup.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        )}
        
        {/* Execution */}
        {exercise.execution && exercise.execution.length > 0 && (
          <Section title="Execution">
            <Card>
              <ol className="space-y-2">
                {exercise.execution.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        )}
        
        {/* Form Cues */}
        {exercise.formCues && exercise.formCues.length > 0 && (
          <Section title="Form Cues">
            <Card className="bg-green-50 border-green-100">
              <ul className="space-y-2">
                {exercise.formCues.map((cue, i) => (
                  <li key={i} className="flex gap-2 text-sm text-green-800">
                    <span>✓</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        )}
      </div>
    </Screen>
  );
}

export default ExerciseDetailScreen;
```

**3. Home Screen** (`src/features/Home/HomeScreen.tsx`)
**4. Groups Screen** (`src/features/Groups/GroupsScreen.tsx`)
**5. Challenges Screen** (`src/features/Challenges/ChallengesScreen.tsx`)
**6. Profile Screen** (`src/features/Profile/ProfileScreen.tsx`)
**7. Auth Screens** (`src/features/Auth/LoginScreen.tsx`, `SignupScreen.tsx`)

### STEP 9: Setup Routing

**Create `src/App.tsx`:**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import all screens
import ExerciseLibraryScreen from './features/Exercises/ExerciseLibraryScreen';
import ExerciseDetailScreen from './features/Exercises/ExerciseDetailScreen';
import HomeScreen from './features/Home/HomeScreen';
import GroupsScreen from './features/Groups/GroupsScreen';
import ChallengesScreen from './features/Challenges/ChallengesScreen';
import ProfileScreen from './features/Profile/ProfileScreen';
import LoginScreen from './features/Auth/LoginScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
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

### STEP 10: Load Exercise Data

**Create `scripts/loadExercises.ts`:**

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import exercisesData from '../catalogExercises_CLEAN.json';

// Copy your Firebase config here
const firebaseConfig = {
  // ... your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadExercises() {
  console.log(`Loading ${exercisesData.documents.length} exercises...`);
  
  for (const exercise of exercisesData.documents) {
    await setDoc(doc(collection(db, 'catalogExercises'), exercise.id), exercise);
    console.log(`✅ Loaded: ${exercise.name}`);
  }
  
  console.log('🎉 All exercises loaded successfully!');
  process.exit(0);
}

loadExercises().catch((error) => {
  console.error('❌ Error loading exercises:', error);
  process.exit(1);
});
```

**Run the script:**
```bash
npx tsx scripts/loadExercises.ts
```

### STEP 11: Deploy Firebase Rules & Indexes

**Create `firestore.rules`:** (See provided file)
**Create `firestore.indexes.json`:** (See provided file)

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## ✅ VALIDATION CHECKLIST

Before considering the build complete, verify:

### Functionality
- [ ] User can browse 113 exercises
- [ ] Filters work (tier_1, tier_2, difficulty)
- [ ] Search works (client-side)
- [ ] Exercise detail screen shows complete info
- [ ] No console errors
- [ ] Firebase connection works

### Design System Compliance
- [ ] All components use design tokens
- [ ] NO custom spacing values (only p-4, p-3, gap-3, etc.)
- [ ] NO custom font sizes (only text-xs through text-3xl)
- [ ] All colors use slate-* (NOT gray-*)
- [ ] All screens wrapped in Screen component
- [ ] All sections use Section component
- [ ] All cards use Card component
- [ ] All list items use ListItem component

### Mobile Performance
- [ ] No horizontal scroll at 375px width
- [ ] All tap targets >= 44px
- [ ] Viewport meta tag correct
- [ ] Input font-size >= 16px (prevents iOS zoom)
- [ ] Smooth scrolling enabled

### Architecture
- [ ] NO direct Firestore queries in components
- [ ] All data access through hooks
- [ ] exerciseService singleton pattern used
- [ ] React Query caching configured
- [ ] TypeScript strict mode enabled
- [ ] No 'any' types used

---

## 🚨 CRITICAL RULES

**NEVER:**
❌ Query Firestore directly from components
❌ Create custom card/list components
❌ Use Tailwind default font sizes
❌ Use gray-* colors (use slate-*)
❌ Use magic number spacing
❌ Design at desktop size first
❌ Skip design tokens

**ALWAYS:**
✅ Use exerciseService through hooks
✅ Use Card, ListItem components
✅ Use mobile-first font scale
✅ Use slate color palette
✅ Use design token spacing
✅ Design at 375px first
✅ Test on mobile viewport

---

## 📦 PROVIDED FILES

You have been provided with these complete, production-ready files:

**Core Files:**
- `exerciseService.ts` - Complete service implementation
- `useExercises.ts` - Complete React Query hooks
- `tokens.css` - Complete design tokens
- `catalogExercises_CLEAN.json` - 113 unique exercises

**Component Library:**
- `Card.tsx` - Universal card component
- `ListItem.tsx` - Mobile list row
- `Screen.tsx` - Screen wrapper
- `Section.tsx` - Content section
- `EmptyState.tsx` - Empty state component
- `LoadingSpinner.tsx` - Loading indicator

**Documentation:**
- `TIIZI_TECHNICAL_SPECIFICATION_CLEAN_BUILD.md` - Complete technical spec
- `COMPONENT_LIBRARY_README.md` - Component usage guide

**DO NOT MODIFY THESE FILES.** They are production-ready and tested.

---

## 🎯 SUCCESS CRITERIA

The build is complete when:

1. ✅ All 113 exercises load from Firestore
2. ✅ Exercise library screen works with filters
3. ✅ Exercise detail screen shows complete info
4. ✅ Search works (2+ characters)
5. ✅ No horizontal scroll on mobile
6. ✅ Design tokens used throughout
7. ✅ Component library used everywhere
8. ✅ No direct Firestore queries in components
9. ✅ TypeScript compiles with no errors
10. ✅ App runs on mobile viewport (375px)

---

## 🚀 START BUILDING

**To begin:**
1. Initialize project with Vite + React + TypeScript
2. Install all dependencies
3. Setup Firebase project (new project in Firebase console)
4. Copy all provided files to correct locations
5. Configure Firebase credentials
6. Load exercise data to Firestore
7. Build screens one by one
8. Test at 375px viewport
9. Deploy to Firebase Hosting

**This is a CLEAN BUILD. No previous code exists. Start from scratch following this guide exactly.**

---

**Good luck! Follow these instructions precisely and you'll build a production-ready mobile PWA.** 🚀
