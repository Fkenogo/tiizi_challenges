# 🚀 WELLNESS CHALLENGES - QUICK START GUIDE

**Get started with wellness challenges in 15 minutes**

---

## 📦 WHAT'S INCLUDED

This wellness challenge system provides **50+ ready-to-use templates** across 8 categories:

1. **Fasting** (8 templates) - 16hr, 18hr, 24hr, 48hr, 72hr, ADF, 5:2
2. **Hydration** (8 templates) - Daily goals, morning rituals, pre-meal water
3. **Sleep** (7 templates) - Consistency, 8-hour streaks, screen-free
4. **Mindfulness** (8 templates) - Meditation, journaling, breathing
5. **Nutrition** (7 templates) - Vegetables, protein, no sugar
6. **Habits** (8 templates) - Routines, alcohol-free, reading
7. **Stress** (7 templates) - Deep breathing, nature walks, journaling
8. **Social** (7 templates) - Connections, kindness, community

**Total: 60 Complete Challenge Templates**

---

## ⚡ FASTEST PATH TO IMPLEMENTATION

### For Developers (3 Steps)

**Step 1: Seed Templates (5 min)**
```bash
# Download wellness-templates.json from outputs folder
# Upload to Firebase console or run seed script

npm run seed:wellness-templates
```

**Step 2: Update Schema (10 min)**
```typescript
// Add to challenges collection
interface Challenge {
  // ... existing fields
  category: 'fitness' | 'fasting' | 'hydration' | 'sleep' | 
            'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  guidelines: string[];
  benefits: string[];
  warnings?: string[];
}
```

**Step 3: Create Logging Service (15 min)**
```typescript
// src/services/wellnessLogService.ts
export const wellnessLogService = {
  logFasting(data: FastingLog): Promise<void>;
  logHydration(data: HydrationLog): Promise<void>;
  logSleep(data: SleepLog): Promise<void>;
  // ... other wellness types
}
```

**Done!** Templates are now available to groups.

---

### For Product/Business (Usage)

**Step 1: Enable in Groups**
- Navigate to group settings
- Enable "Wellness Challenges"
- Browse template library

**Step 2: Adopt Template**
- Choose category (Fasting, Hydration, etc.)
- Select difficulty level
- Preview template details
- Tap "Adopt to Group"

**Step 3: Customize (Optional)**
- Rename challenge
- Adjust start date
- Modify point values
- Publish to group

**Members can now join and log activities!**

---

## 📋 TEMPLATE CATALOG

### FASTING CHALLENGES

| Template | Duration | Difficulty | Protocol |
|----------|----------|------------|----------|
| 16-Hour Fast (16/8) | 21 days | ⭐⭐ Beginner | 16hr fast, 8hr eat |
| 18-Hour Fast (18/6) | 21 days | ⭐⭐⭐ Intermediate | 18hr fast, 6hr eat |
| 20-Hour Fast (20/4) | 21 days | ⭐⭐⭐⭐ Advanced | 20hr fast, 4hr eat |
| 24-Hour Fast (OMAD) | 30 days | ⭐⭐⭐⭐ Advanced | One meal a day, 3x/week |
| 48-Hour Fast | Monthly | ⭐⭐⭐⭐⭐ Expert | 2-day fast, monthly |
| 72-Hour Fast | Quarterly | ⭐⭐⭐⭐⭐ Medical | 3-day fast, medical supervision |
| Alternate Day Fasting | 30 days | ⭐⭐⭐⭐⭐ Expert | 36hr fast every other day |
| 5:2 Diet Protocol | 30 days | ⭐⭐⭐ Intermediate | 2 days/week 500-600 cal |

### HYDRATION CHALLENGES

| Template | Duration | Difficulty | Target |
|----------|----------|------------|--------|
| Daily Hydration 2L | 21 days | ⭐⭐ Beginner | 2L water daily |
| Enhanced Hydration 3L | 21 days | ⭐⭐⭐ Intermediate | 3L water daily |
| Athlete Hydration 4L | 21 days | ⭐⭐⭐⭐ Advanced | 4L water daily |
| Morning Hydration | 30 days | ⭐⭐ Beginner | 500ml within 30min of waking |
| Pre-Meal Water | 21 days | ⭐⭐ Beginner | 250ml before each meal |
| Workout Hydration | 21 days | ⭐⭐⭐ Intermediate | Protocol around exercise |
| No Sugary Drinks | 30 days | ⭐⭐⭐ Intermediate | Water only challenge |
| Hydration Streak | 90 days | ⭐⭐⭐ Intermediate | Daily goal consistency |

### SLEEP CHALLENGES

| Template | Duration | Difficulty | Target |
|----------|----------|------------|--------|
| 8-Hour Sleep Streak | 21 days | ⭐⭐ Beginner | 8 hours nightly |
| Sleep Consistency | 21 days | ⭐⭐⭐ Intermediate | Same bed/wake time |
| Early Bedtime | 21 days | ⭐⭐⭐ Intermediate | In bed by 10 PM |
| Screen-Free Hour | 30 days | ⭐⭐ Beginner | No screens 1hr before bed |
| Sleep Optimization | 30 days | ⭐⭐⭐⭐ Advanced | Complete protocol |
| Power Nap Master | 21 days | ⭐⭐⭐ Intermediate | Strategic 20-min naps |

### MINDFULNESS CHALLENGES

| Template | Duration | Difficulty | Practice |
|----------|----------|------------|----------|
| 5-Min Meditation | 21 days | ⭐⭐ Beginner | Daily 5 minutes |
| 10-Min Mindfulness | 30 days | ⭐⭐⭐ Intermediate | Daily 10 minutes |
| 20-Min Deep Practice | 30 days | ⭐⭐⭐⭐ Advanced | Daily 20 minutes |
| Gratitude Journaling | 30 days | ⭐⭐ Beginner | 3 things daily |
| Breathing Exercises | 21 days | ⭐⭐ Beginner | 3x daily, 5 min each |
| Mindful Eating | 21 days | ⭐⭐⭐ Intermediate | Conscious meal practice |
| Digital Detox | 30 days | ⭐⭐⭐ Intermediate | Screen-free hours |

### NUTRITION CHALLENGES

| Template | Duration | Difficulty | Goal |
|----------|----------|------------|------|
| 5-a-Day Vegetables | 21 days | ⭐⭐ Beginner | 5 veggie servings |
| 7-a-Day Produce | 30 days | ⭐⭐⭐ Intermediate | 7 fruit/veg servings |
| Daily Protein Target | 30 days | ⭐⭐⭐ Intermediate | Meet protein goal |
| 30-Day No Sugar | 30 days | ⭐⭐⭐⭐ Advanced | Zero added sugar |
| Whole Foods Only | 21 days | ⭐⭐⭐ Intermediate | No processed foods |
| Meal Prep Mastery | 30 days | ⭐⭐⭐ Intermediate | Weekly meal prep |
| No Processed Foods | 30 days | ⭐⭐⭐⭐ Advanced | Whole foods only |

---

## 🎯 COMMON USE CASES

### Use Case 1: Weight Loss Group

**Recommended Templates:**
1. 16-Hour Fast (16/8) - Primary challenge
2. Daily Hydration 2L - Support challenge  
3. 5-a-Day Vegetables - Nutrition support
4. 10K Steps Daily - Activity support

**Why This Works:**
- Fasting for calorie control
- Hydration reduces hunger
- Vegetables for nutrients/fullness
- Steps for calorie burn

### Use Case 2: Wellness Group

**Recommended Templates:**
1. Morning Hydration - Start day right
2. 5-Min Meditation - Mental health
3. Gratitude Journaling - Emotional health
4. 8-Hour Sleep - Recovery

**Why This Works:**
- Holistic health approach
- Manageable for beginners
- Builds lasting habits
- Addresses multiple wellness areas

### Use Case 3: Athletic Performance Group

**Recommended Templates:**
1. Sleep Consistency - Recovery
2. Athlete Hydration 4L - Performance
3. Daily Protein Target - Muscle building
4. Power Nap Mastery - Energy optimization

**Why This Works:**
- Optimizes recovery
- Supports training demands
- Enhances performance
- Science-backed protocols

---

## 📊 DATA STRUCTURE OVERVIEW

### Collections Needed

```
Firestore/
├── wellnessTemplates/          # Pre-built templates (seed once)
├── challenges/                 # Active challenges (includes wellness)
├── challengeMembers/           # Participation tracking
├── wellnessLogs/              # Activity logs
└── users/                     # User stats (updated by logs)
```

### Key Documents

**Template Example:**
```typescript
{
  id: "fasting-16hr-beginner",
  category: "fasting",
  name: "16-Hour Daily Fast",
  difficulty: "beginner",
  duration: 21,
  activities: [...],
  guidelines: [...],
  benefits: [...],
  warnings: [...]
}
```

**Log Example:**
```typescript
{
  id: "log_123",
  userId: "user_abc",
  challengeId: "challenge_xyz",
  logType: "fasting",
  fastingData: {
    startTime: Timestamp,
    endTime: Timestamp,
    duration: 16,
    completed: true
  },
  points: 10,
  date: "2026-02-26"
}
```

---

## 🔧 INTEGRATION POINTS

### With Existing System

**Groups:**
- Wellness challenges link to `groupId`
- Only group members can access
- Same permission model as fitness

**Points System:**
- Wellness logs award points
- Points added to user total
- Leaderboard includes wellness
- Same gamification mechanics

**User Profile:**
- Wellness stats in `users.stats`
- Challenge history tracked
- Streaks calculated
- Badges earned

**Notifications:**
- Reminder to log activity
- Streak alerts
- Challenge milestones
- Group achievements

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Database Setup
- [ ] Create `wellnessTemplates` collection
- [ ] Seed with 60 templates
- [ ] Update `challenges` schema
- [ ] Add wellness log structure

### Phase 2: Services
- [ ] Create `wellnessLogService.ts`
- [ ] Update `challengeService.ts`
- [ ] Add streak calculation
- [ ] Implement points logic

### Phase 3: UI Components
- [ ] Template gallery screen
- [ ] Template detail screen
- [ ] Logging screens (per type)
- [ ] Progress visualization

### Phase 4: Testing
- [ ] Template adoption flow
- [ ] Logging for each type
- [ ] Points calculation
- [ ] Streak tracking
- [ ] Mobile UI (375px)

### Phase 5: Launch
- [ ] User documentation
- [ ] Group admin guide
- [ ] Medical disclaimers
- [ ] Support resources

---

## 📱 MOBILE UI REQUIREMENTS

All wellness challenge screens must follow:

**Spacing:**
- Only p-3, p-4, p-6
- Only gap-2, gap-3

**Typography:**
- text-xs through text-3xl only
- Screen titles: text-3xl
- Card titles: text-2xl
- Body: text-base

**Components:**
- Use Screen wrapper
- Use Section for groups
- Use Card for content
- Use ListItem for lists

**Tap Targets:**
- All buttons: h-11 minimum (44px)
- All interactive elements: >= 44px

See `MOBILE_CONSTRAINTS.md` for full details.

---

## 📚 FULL DOCUMENTATION

For complete details on each category:

1. `WELLNESS_CHALLENGES_OVERVIEW.md` - Master index
2. `FASTING_CHALLENGES.md` - All 8 fasting templates with full protocols
3. `HYDRATION_CHALLENGES.md` - All 8 hydration templates
4. `SLEEP_CHALLENGES.md` - All 7 sleep templates
5. `MINDFULNESS_CHALLENGES.md` - All 8 mindfulness templates
6. `NUTRITION_CHALLENGES.md` - All 7 nutrition templates
7. `HABIT_CHALLENGES.md` - All 8 habit templates
8. `STRESS_CHALLENGES.md` - All 7 stress templates
9. `SOCIAL_CHALLENGES.md` - All 7 social templates
10. `WELLNESS_TECHNICAL_GUIDE.md` - Implementation details
11. `wellness-templates.json` - Complete JSON export

---

## 🎉 READY TO GO!

You now have:
- ✅ 60 Complete challenge templates
- ✅ Full technical specifications
- ✅ Implementation guide
- ✅ Mobile UI guidelines
- ✅ Safety protocols
- ✅ Medical disclaimers

**Next Steps:**
1. Review category documents for template details
2. Seed templates into Firestore
3. Build logging UI for your priority categories
4. Test with pilot group
5. Launch to all groups

---

**Questions?** Consult the detailed category documents or technical guide.

**Version:** 1.0  
**Last Updated:** February 2026
