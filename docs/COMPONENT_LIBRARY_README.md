# 📱 Tiizi Mobile Component Library

Complete mobile-first component library for building touch-friendly PWA interfaces.

---

## 📦 Components

### **Layout Components** (`src/components/Layout/`)

#### Screen
Standard screen container with consistent padding.

```tsx
import { Screen } from '@/components/Layout';

function MyScreen() {
  return (
    <Screen>
      {/* Content automatically has 16px padding */}
    </Screen>
  );
}
```

**Props:**
- `noPadding?: boolean` - Remove default padding (for full-width content)
- `noBottomPadding?: boolean` - Remove bottom padding for nav bar
- `className?: string` - Additional Tailwind classes

#### Section
Groups related content with optional title and action.

```tsx
import { Section } from '@/components/Layout';

function MyScreen() {
  return (
    <Section 
      title="Recent Activity"
      action={<button>See All</button>}
    >
      <Card>Item 1</Card>
      <Card>Item 2</Card>
    </Section>
  );
}
```

**Props:**
- `title?: string` - Section heading
- `action?: ReactNode` - Action button (e.g., "See All")
- `spacing?: 'tight' | 'normal' | 'loose'` - Vertical spacing
- `className?: string` - Additional classes

---

### **Mobile Components** (`src/components/Mobile/`)

#### Card
Universal card component with 3 variants.

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
  <p>Click me!</p>
</Card>
```

**Props:**
- `variant?: 'default' | 'compact' | 'flat'`
- `interactive?: boolean` - Add press animation
- `onClick?: () => void` - Click handler
- `className?: string` - Additional classes

---

#### ListItem
Mobile list row with icon, text, value, and chevron.

```tsx
import { ListItem } from '@/components/Mobile';

// Basic list item
<ListItem title="Settings" />

// With subtitle
<ListItem 
  title="Account" 
  subtitle="Manage your profile"
/>

// With icon
<ListItem 
  icon={<Settings size={18} />}
  title="Settings"
  onClick={() => navigate('/settings')}
/>

// With value
<ListItem 
  title="Sarah Jenkins"
  value="12.5k"
/>

// With badge
<ListItem 
  title="Push-Ups"
  subtitle="Upper Body"
  badge="reps"
/>

// Full example (leaderboard)
<ListItem
  icon={<img src={avatar} />}
  title="Sarah Jenkins"
  subtitle="🔥 12 day streak"
  value="12.5k"
  badge="🥇"
/>
```

**Props:**
- `icon?: ReactNode` - Left icon (auto-wrapped in styled container)
- `title: string` - Main text (required)
- `subtitle?: string` - Secondary text
- `value?: string | number` - Right-aligned value
- `badge?: string` - Colored badge
- `chevron?: boolean` - Show right chevron (default: true if onClick)
- `onClick?: () => void` - Click handler
- `className?: string` - Additional classes

**Auto-styling:**
- Minimum 48px height (iOS HIG)
- Hover effect on clickable items
- Last item has no border
- Icon auto-wrapped in primary-colored container

---

#### EmptyState
Friendly empty state message.

```tsx
import { EmptyState } from '@/components/Mobile';
import { Search } from 'lucide-react';

// Basic
<EmptyState
  icon={<Search size={48} />}
  title="No results found"
/>

// With message
<EmptyState
  icon={<Search size={48} />}
  title="No exercises found"
  message="Try adjusting your filters"
/>

// With action button
<EmptyState
  icon={<Users size={48} />}
  title="No groups yet"
  message="Create your first fitness group"
  action={
    <button onClick={() => navigate('/create')}>
      Create Group
    </button>
  }
/>
```

**Props:**
- `icon: ReactNode` - Large icon (required)
- `title: string` - Main heading (required)
- `message?: string` - Supporting text
- `action?: ReactNode` - Action button
- `className?: string` - Additional classes

---

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

// In button
<button disabled={isLoading}>
  {isLoading ? <LoadingSpinner size="sm" /> : 'Submit'}
</button>

// Different sizes
<LoadingSpinner size="sm" />  {/* 16px */}
<LoadingSpinner size="md" />  {/* 32px - default */}
<LoadingSpinner size="lg" />  {/* 48px */}
```

**Props:**
- `size?: 'sm' | 'md' | 'lg'` - Spinner size
- `fullScreen?: boolean` - Center in viewport
- `label?: string` - Loading text
- `className?: string` - Additional classes

---

## 🎨 Design Tokens

All components use design tokens from `src/styles/tokens.css`.

### Spacing Scale
```css
--space-1: 4px    /* Minimal */
--space-2: 8px    /* Tight */
--space-3: 12px   /* Compact */
--space-4: 16px   /* Standard (DEFAULT) */
--space-5: 20px   /* Comfortable */
--space-6: 24px   /* Generous */
--space-8: 32px   /* Large */
```

Use via Tailwind:
```tsx
<div className="p-4">   {/* 16px padding */}
<div className="gap-3"> {/* 12px gap */}
<div className="mt-6">  {/* 24px margin-top */}
```

### Typography Scale
```css
--text-xs: 10px    /* Labels, badges */
--text-sm: 12px    /* Secondary text */
--text-base: 14px  /* Body text (DEFAULT) */
--text-lg: 16px    /* Emphasized text */
--text-xl: 18px    /* Section headings */
--text-2xl: 20px   /* Card titles */
--text-3xl: 24px   /* Screen titles */
```

Use via Tailwind:
```tsx
<p className="text-sm">   {/* 12px */}
<p className="text-base"> {/* 14px - DEFAULT */}
<h3 className="text-xl">  {/* 18px */}
```

### Colors
```css
--primary: #ff6b00       /* Tiizi Orange */
--slate-100: #f1f5f9     /* Light gray */
--slate-500: #64748b     /* Medium gray */
--slate-900: #0f172a     /* Dark gray */
```

Use via Tailwind:
```tsx
<div className="bg-primary">      {/* Orange background */}
<div className="text-slate-500">  {/* Gray text */}
<div className="border-slate-100"> {/* Light border */}
```

---

## 📋 Usage Patterns

### Standard Screen Layout

```tsx
import { Screen, Section } from '@/components/Layout';
import { Card, ListItem, LoadingSpinner, EmptyState } from '@/components/Mobile';

function MyScreen() {
  const { data, isLoading, error } = useMyData();
  
  // Loading state
  if (isLoading) return <LoadingSpinner fullScreen />;
  
  // Error state
  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle size={48} />}
        title="Something went wrong"
        message={error.message}
      />
    );
  }
  
  // Empty state
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Search size={48} />}
        title="No data found"
        message="Try again later"
      />
    );
  }
  
  // Success state
  return (
    <Screen>
      <Section title="Section Title" action={<button>See All</button>}>
        <Card>
          {data.map(item => (
            <ListItem
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              onClick={() => navigate(`/detail/${item.id}`)}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
```

### Settings Menu

```tsx
<Screen>
  <Section title="Account">
    <Card variant="flat">
      <ListItem 
        icon={<Settings size={18} />}
        title="Account Settings"
        subtitle="Manage your profile"
        onClick={() => navigate('/settings')}
      />
      <ListItem 
        icon={<Lock size={18} />}
        title="Privacy"
        subtitle="Control your data"
        onClick={() => navigate('/privacy')}
      />
      <ListItem 
        icon={<Bell size={18} />}
        title="Notifications"
        onClick={() => navigate('/notifications')}
      />
    </Card>
  </Section>
</Screen>
```

### Exercise List

```tsx
<Screen>
  <Section title="Core Exercises">
    <div className="space-y-3">
      {exercises.map(exercise => (
        <Card 
          key={exercise.id}
          interactive
          onClick={() => navigate(`/exercises/${exercise.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                fitness_center
              </span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">{exercise.name}</p>
              <p className="text-xs text-slate-500">
                {exercise.tier_2} • {exercise.difficulty}
              </p>
            </div>
            <span className="text-xs font-bold text-primary px-2 py-1 bg-primary/10 rounded-full">
              {exercise.metric.unit}
            </span>
          </div>
        </Card>
      ))}
    </div>
  </Section>
</Screen>
```

### Leaderboard

```tsx
<Screen>
  <Section title="Leaderboard">
    <Card variant="flat">
      {rankings.map((user, index) => (
        <ListItem
          key={user.id}
          icon={
            <img 
              src={user.avatar} 
              className="w-full h-full rounded-full object-cover" 
            />
          }
          title={user.name}
          subtitle={`🔥 ${user.streak} day streak`}
          value={user.points}
          badge={index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : undefined}
        />
      ))}
    </Card>
  </Section>
</Screen>
```

---

## ✅ Best Practices

### DO ✅
- Use `Screen` wrapper for all screens
- Use `Section` to group related content
- Use `Card` variants (don't create custom cards)
- Use `ListItem` for list rows (don't create custom rows)
- Use design tokens via Tailwind classes
- Keep components composable
- Test on 375px viewport

### DON'T ❌
- Don't create custom padding values (`p-[18px]`)
- Don't create custom font sizes (`text-[15px]`)
- Don't nest `Card` inside `Card`
- Don't skip `Screen` wrapper
- Don't hardcode colors (use tokens)
- Don't exceed 480px max-width

---

## 🎯 Component Checklist

Before creating a new component, check:
- [ ] Can I use `Card` instead?
- [ ] Can I use `ListItem` instead?
- [ ] Am I using design tokens?
- [ ] Is it mobile-first (designed at 375px)?
- [ ] Are tap targets >= 44px?
- [ ] Is it accessible (keyboard nav, ARIA)?
- [ ] Did I add JSDoc comments?
- [ ] Did I test on mobile viewport?

---

## 📱 Testing

Test every component at these widths:
- **375px** - iPhone SE (smallest)
- **393px** - iPhone 14 Pro
- **430px** - iPhone 14 Pro Max

Check:
- No horizontal scroll
- All text readable
- Tap targets >= 44px
- Proper spacing
- Loading/error states work

---

## 🚀 Migration

Migrate screens one at a time:

1. Wrap in `<Screen>`
2. Group content in `<Section>`
3. Replace custom cards with `<Card>`
4. Replace custom rows with `<ListItem>`
5. Test at 375px
6. Move to next screen

---

**Questions? Review the full spec: `TIIZI_TECHNICAL_SPECIFICATION_v2.md` sections 21-22**
