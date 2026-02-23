# Tiizi Revamp - Implementation TODO

## Phase 1: Mobile Design Pattern Fixes (PRIMARY TASK) ✅ COMPLETED

### 1.1 GroupsScreen - Mobile-Native Redesign ✅

- [x] Reduce GroupCard image height from 214px to 64px (w-16 h-16)
- [x] Tighten padding from p-4 to p-3
- [x] Reduce font sizes to use tokens (text-lg → text-base for titles)
- [x] Change from card-based to row-based layout
- [x] Use ListItem component pattern (compact row)

### 1.2 HomeScreen - Mobile-Native Redesign ✅

- [x] Reduce Active Challenge card padding (p-5 → p-4)
- [x] Tighten Today's Goals list items (h-72px → py-3)
- [x] Reduce Trending Challenges grid spacing (gap-3 → gap-2)
- [x] Use consistent typography from tokens
- [x] Compact bottom navigation

### 1.3 ChallengesScreen - Mobile-Native Redesign ✅

- [x] Reduce template card image height (340px → 96px)
- [x] Tighten ongoing challenge cards
- [x] Use list-based layout for challenges
- [x] Compact navigation

### 1.4 ProfileScreen - Mobile-Native Redesign ✅

- [x] Reduce stat cards from h-[96px] to compact (py-3)
- [x] Use ListItem for group items
- [x] Tighten spacing throughout

### 1.5 ExerciseLibraryScreen - Mobile-Native Redesign ✅

- [x] Reduce exercise card image size (h-28 w-28 → w-16 h-16)
- [x] Tighten padding
- [x] Use consistent font sizes

## Phase 2: Component Library Utilization

### 2.1 Central Navigation Component

- [ ] Create shared BottomNav component in components/Layout
- [ ] Replace duplicated nav bars in 5+ screens

### 2.2 Card Component Usage

- [ ] Replace all custom card divs with <Card> component
- [ ] Ensure consistent variants used

### 2.3 ListItem Component Usage

- [ ] Replace list items with <ListItem>
- [ ] Use for all row-based content

## Phase 3: Critical Bug Fixes

### 3.1 Firebase Connection Verification

- [ ] Check firebase.ts configuration
- [ ] Verify environment variables
- [ ] Test service layer connectivity

### 3.2 Error Handling

- [ ] Add error boundaries
- [ ] Improve error states in screens

---

## Implementation Status

### Completed:

- [x] TODO.md created
- [x] GroupsScreen mobile redesign
- [x] HomeScreen mobile redesign
- [x] ChallengesScreen mobile redesign
- [x] ProfileScreen mobile redesign
- [x] ExerciseLibraryScreen mobile redesign

### In Progress:

- [ ]

### Remaining:

- [ ] All Phase 2 items
- [ ] All Phase 3 items
