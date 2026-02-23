# TIIZI FITNESS PWA - TECHNICAL SPECIFICATION

**Version:** 1.0 - Greenfield Build  
**Date:** February 19, 2026  
**Project Type:** NEW BUILD FROM SCRATCH  
**Status:** Ready for Development

> **🎯 THIS IS A CLEAN BUILD:** No previous code exists. This is a brand new project starting from zero.

---

## PROJECT OVERVIEW

**What We're Building:**
A mobile-first Progressive Web App (PWA) for group fitness challenges.

**Core Features:**
- 113-exercise catalog (foundation)
- User authentication (Firebase)
- Group fitness challenges
- Social features & leaderboards
- Workout logging & progress tracking
- Mobile-native UI (375px viewport)

**Tech Stack:**
- React 18.3 + TypeScript 5.x
- Vite 5.x (build tool)
- Tailwind CSS 3.x (mobile-first)
- React Router v6
- TanStack Query (React Query)
- Firebase (Auth, Firestore, Storage, Hosting)
- Lucide React (icons)

---

## ARCHITECTURE PRINCIPLES

### 1. Exercise-First Architecture
The exercise catalog is the SINGLE SOURCE OF TRUTH.
- All challenges built FROM exercises
- All workouts logged AGAINST exercises
- All progress tracked PER exercise

### 2. Mobile-First Design
Design for 375px mobile screens FIRST.
- Start at 375px viewport
- Touch-friendly (44px minimum tap targets)
- Optimize for vertical scrolling
- Scale UP to tablet/desktop

### 3. Service Layer Pattern
Components NEVER talk to Firestore directly.
- `exerciseService` owns all exercise operations
- React Query hooks wrap the service
- Components only use hooks

---

## PROJECT STRUCTURE

```
tiizi/                          # NEW PROJECT ROOT
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Screen.tsx      # Create new
│   │   │   ├── Section.tsx     # Create new
│   │   │   └── index.ts        # Create new
│   │   └── Mobile/
│   │       ├── Card.tsx        # Create new
│   │       ├── ListItem.tsx    # Create new
│   │       ├── EmptyState.tsx  # Create new
│   │       ├── LoadingSpinner.tsx # Create new
│   │       └── index.ts        # Create new
│   ├── features/
│   │   ├── Exercises/
│   │   │   ├── ExerciseLibraryScreen.tsx # Create new
│   │   │   └── ExerciseDetailScreen.tsx  # Create new
│   │   ├── Home/
│   │   │   └── HomeScreen.tsx  # Create new
│   │   ├── Groups/
│   │   │   └── GroupsScreen.tsx # Create new
│   │   ├── Challenges/
│   │   │   └── ChallengesScreen.tsx # Create new
│   │   ├── Profile/
│   │   │   └── ProfileScreen.tsx # Create new
│   │   └── Auth/
│   │       ├── LoginScreen.tsx  # Create new
│   │       └── SignupScreen.tsx # Create new
│   ├── hooks/
│   │   └── useExercises.ts     # Create new
│   ├── services/
│   │   └── exerciseService.ts  # Create new
│   ├── lib/
│   │   └── firebase.ts         # Create new
│   ├── styles/
│   │   └── tokens.css          # Create new
│   ├── types/
│   │   └── index.ts            # Create new
│   ├── App.tsx                 # Create new
│   ├── main.tsx                # Create new
│   └── index.css               # Create new
├── scripts/
│   └── loadExercises.ts        # Create new
├── public/
│   └── manifest.json           # Create new
├── firestore.rules             # Create new
├── firestore.indexes.json      # Create new
├── firebase.json               # Create new
├── tailwind.config.js          # Create new
├── tsconfig.json               # Create new
├── vite.config.ts              # Create new
└── package.json                # Create new
```

---

## DESIGN SYSTEM

### Design Tokens (src/styles/tokens.css)

```css
:root {
  /* Spacing - Mobile-optimized */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;   /* Standard */
  --space-6: 24px;
  --space-8: 32px;
  
  /* Typography - Mobile-optimized */
  --text-xs: 10px;    /* Labels */
  --text-sm: 12px;    /* Secondary */
  --text-base: 14px;  /* Body (DEFAULT) */
  --text-lg: 16px;    /* Emphasized */
  --text-xl: 18px;    /* Section headings */
  --text-2xl: 20px;   /* Card titles */
  --text-3xl: 24px;   /* Screen titles */
  
  /* Colors */
  --primary: #ff6b00;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-500: #64748b;
  --slate-900: #0f172a;
  
  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;  /* Cards */
  --radius-lg: 16px;
  --radius-full: 9999px;
  
  /* Container */
  --container-max: 480px;
}
```

### Tailwind Config (tailwind.config.js)

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
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
        primary: { DEFAULT: 'var(--primary)' },
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

## BUILD SEQUENCE

### Phase 1: Project Setup (Day 1)

**1. Create New Project**
```bash
npm create vite@latest tiizi -- --template react-ts
cd tiizi
npm install
```

**2. Install Dependencies**
```bash
npm install firebase react-router-dom @tanstack/react-query lucide-react
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

**3. Create New Firebase Project**
- Go to Firebase Console
- Click "Add project"
- Name: "tiizi-fitness" (or your choice)
- Enable Google Analytics (optional)
- Create project

**4. Initialize Firebase in Project**
```bash
npm install -g firebase-tools
firebase login
firebase init
# Select: Firestore, Hosting, Storage
firebase use --add
# Select your new Firebase project
```

**5. Create Directory Structure**
```bash
mkdir -p src/components/Layout src/components/Mobile
mkdir -p src/features/Exercises src/features/Home src/features/Groups
mkdir -p src/features/Challenges src/features/Profile src/features/Auth
mkdir -p src/hooks src/services src/lib src/styles src/types scripts
```

### Phase 2: Foundation (Days 2-3)

**1. Create Design System**
- Copy `tokens.css` to `src/styles/`
- Create `src/index.css` (import tokens)
- Create `tailwind.config.js` (use provided config)

**2. Create Firebase Config**
- Create `src/lib/firebase.ts`
- Add Firebase config from Firebase Console
- Create `.env` file with credentials

**3. Create TypeScript Types**
- Create `src/types/index.ts`
- Add all interfaces (CatalogExercise, User, Group, Challenge)

**4. Create Service Layer**
- Copy `exerciseService.ts` to `src/services/`
- Copy `useExercises.ts` to `src/hooks/`

**5. Create Component Library**
- Copy all provided components to respective folders
- Create index files for clean imports

### Phase 3: Core Screens (Days 4-7)

**Create screens in this order:**

1. **ExerciseLibraryScreen.tsx** - Browse exercises with filters
2. **ExerciseDetailScreen.tsx** - View exercise details
3. **HomeScreen.tsx** - Dashboard
4. **GroupsScreen.tsx** - View groups
5. **ChallengesScreen.tsx** - Browse challenges
6. **ProfileScreen.tsx** - User profile
7. **LoginScreen.tsx** - Authentication
8. **SignupScreen.tsx** - Registration

### Phase 4: Data Loading (Day 8)

**1. Create Load Script**
- Create `scripts/loadExercises.ts`
- Add Firebase config
- Import `catalogExercises_CLEAN.json`

**2. Load Exercises to Firestore**
```bash
npx tsx scripts/loadExercises.ts
```

**3. Verify in Firebase Console**
- Check `catalogExercises` collection
- Confirm 113 documents

### Phase 5: Routing (Day 9)

**1. Create App.tsx**
- Setup React Router
- Setup React Query
- Add all routes

**2. Create main.tsx**
- Render App component

### Phase 6: Deployment (Days 10-14)

**1. Create Firestore Rules**
- Create `firestore.rules`
- Deploy: `firebase deploy --only firestore:rules`

**2. Create Firestore Indexes**
- Create `firestore.indexes.json`
- Deploy: `firebase deploy --only firestore:indexes`

**3. Test Locally**
```bash
npm run dev
```

**4. Build for Production**
```bash
npm run build
```

**5. Deploy to Firebase**
```bash
firebase deploy
```

---

## FIRESTORE STRUCTURE

```
catalogExercises/          # 113 exercises (read-only)
  {exerciseId}/
    - id, name, tier_1, tier_2, difficulty
    - metric: { type, unit }
    - setup[], execution[], formCues[]
    - musclesTargeted[], equipment[]

users/                     # User profiles
  {userId}/
    - email, displayName, photoURL
    - stats: { level, streak, totalWorkouts }

groups/                    # Fitness groups
  {groupId}/
    - name, description, coverImage
    - createdBy, memberCount
    
challenges/                # Fitness challenges
  {challengeId}/
    - name, type, groupId
    - activities[] (exercise snapshots)
    
workouts/                  # Logged workouts
  {workoutId}/
    - userId, exerciseId, value
    - loggedAt
```

---

## COMPONENT LIBRARY

### Screen (Layout wrapper)
```tsx
<Screen>
  {/* Content with auto padding & bottom spacing */}
</Screen>
```

### Section (Content grouping)
```tsx
<Section title="Recent Activity" action={<button>See All</button>}>
  <Card>Content</Card>
</Section>
```

### Card (Universal card)
```tsx
<Card variant="default">Content</Card>
<Card variant="compact">Tight</Card>
<Card variant="flat">List</Card>
```

### ListItem (Mobile list row)
```tsx
<ListItem
  icon={<Icon />}
  title="Title"
  subtitle="Subtitle"
  value="123"
  badge="reps"
  onClick={() => {}}
/>
```

### EmptyState (Empty states)
```tsx
<EmptyState
  icon={<Search size={48} />}
  title="No exercises found"
  message="Try adjusting filters"
/>
```

### LoadingSpinner (Loading indicator)
```tsx
<LoadingSpinner fullScreen />
<LoadingSpinner size="sm" />
```

---

## SUCCESS CRITERIA

### Functionality
- ✅ Browse 113 exercises
- ✅ Filter by tier_1, tier_2, difficulty
- ✅ Search exercises
- ✅ View exercise details
- ✅ User authentication
- ✅ Create/join groups
- ✅ Create/join challenges

### Mobile Performance
- ✅ No horizontal scroll at 375px
- ✅ All tap targets >= 44px
- ✅ Load time < 3 seconds
- ✅ Lighthouse score >= 90

### Code Quality
- ✅ Design tokens used throughout
- ✅ Component library used everywhere
- ✅ No direct Firestore queries in components
- ✅ TypeScript strict mode
- ✅ No console errors

---

## CRITICAL RULES

**NEVER:**
- ❌ Query Firestore directly from components
- ❌ Create custom cards/lists
- ❌ Use gray-* colors (use slate-*)
- ❌ Use magic number spacing
- ❌ Design at desktop size first

**ALWAYS:**
- ✅ Use exerciseService through hooks
- ✅ Use Card, ListItem components
- ✅ Use slate color palette
- ✅ Use design token spacing
- ✅ Design at 375px first

---

**This is a GREENFIELD PROJECT. Start from scratch. No previous code exists.**
