# Tiizi Version 2 Wellness Catalogue Rationalisation Matrix

**Status:** Draft for founder review

**Basis:** Approved Version 2 Wellness Knowledge Model and the 67-activity Version 1 audit.

**Purpose:** Decide what to keep, rename, merge, split, reclassify, restrict, retire or add before detailed content is written or code is changed.

## Decision meanings

- **KEEP** — retain the activity with rewritten Version 2 content.

- **RENAME** — retain the concept but change the user-facing name and usually the target wording.

- **MERGE** — consolidate duplicates or near-duplicates into one canonical activity.

- **SPLIT** — separate materially different forms where instructions, tracking or safety differ.

- **RECLASSIFY** — move the activity to a more appropriate domain or family.

- **RESTRICT** — retain only with stronger safety, privacy or professional-guidance controls.

- **RETIRE** — remove from the Version 2 public catalogue.

- **ADD / ADD LATER** — create a new activity now or hold it for a controlled later release.

## Founder-level recommendations

1. Do not migrate the current catalogue directly. Rationalise first, then write content.

2. Merge duplicate concepts before assigning new IDs.

3. Keep sensitive activities private, non-competitive and clinically governed.

4. Use user-configurable targets where a universal value would mislead.

5. Launch Version 2 with lower-risk activities first; hold longer fasting and clinical tracking behind review gates.

## Master matrix

| Current ID                     | Current Activity        | Decision   | Proposed V2 Activity             | V2 Domain                | V2 Family                 | Risk Level            | Rationale                                                                                                         |
|:-------------------------------|:------------------------|:-----------|:---------------------------------|:-------------------------|:--------------------------|:----------------------|:------------------------------------------------------------------------------------------------------------------|
| movement-steps                 | Steps                   | KEEP       | Daily Steps                      | Movement                 | Walking & Daily Activity  | Low                   | Retain; clear, familiar and device-friendly. Allow configurable targets rather than treating 10,000 as universal. |
| movement-walking               | Walking                 | RENAME     | 30-Minute Walk                   | Movement                 | Walking & Daily Activity  | Low                   | Make the expected action explicit. Keep customizable duration as a variation.                                     |
| movement-walking-dist          | Walking Distance        | MERGE      | Distance Walk                    | Movement                 | Walking & Daily Activity  | Low                   | Merge into the walking family as a distance-based variation rather than a separate conceptual activity.           |
| movement-running               | Running / Jogging       | SPLIT      | Jogging / Running                | Movement                 | Running                   | General caution       | Split by intensity or pace if challenge logic differs. Fix the incorrect walking metric.                          |
| movement-cycling               | Cycling                 | KEEP       | Cycling                          | Movement                 | Cycling                   | General caution       | Retain with distance or duration variations and activity-specific safety guidance.                                |
| movement-stretching            | Stretching              | RECLASSIFY | Daily Stretching                 | Recovery & Mobility      | Flexibility               | General caution       | Move from general movement into recovery and mobility.                                                            |
| movement-mobility              | Mobility Routine        | KEEP       | Mobility Routine                 | Recovery & Mobility      | Mobility                  | General caution       | Retain as distinct from stretching; focus on joint range and controlled movement.                                 |
| movement-yoga                  | Yoga                    | SPLIT      | Yoga Practice                    | Movement                 | Yoga                      | General caution       | Split only where style or intensity materially changes the protocol; otherwise retain as a configurable family.   |
| hydration-2l-daily             | Water Intake            | RENAME     | Track Daily Water Intake         | Hydration                | Daily Hydration           | General caution       | Avoid implying 2 litres is universally correct. Make the target user-configurable.                                |
| hydration-3l-daily             | Enhanced Hydration      | RETIRE     | —                                | Hydration                | Daily Hydration           | Elevated              | A fixed 3-litre target is not broadly appropriate and duplicates daily water tracking.                            |
| hydration-morning-500ml        | Morning Water           | RENAME     | Morning Water                    | Hydration                | Timed Hydration           | Low                   | Retain the habit but allow a smaller default or user-set amount; avoid presenting 500 ml as mandatory.            |
| hydration-no-sugar-drinks      | No Sugary Drinks        | RECLASSIFY | Replace Sugary Drinks With Water | Nutrition                | Drink Choices             | Low                   | This is a dietary behaviour, not a hydration-volume activity.                                                     |
| hydration-electrolyte          | Electrolyte Hydration   | RESTRICT   | Electrolyte Rehydration          | Hydration                | Exercise & Heat Hydration | Professional guidance | Do not promote as an everyday universal habit. Restrict to context-specific use with clear cautions.              |
| sleep-8hr-sleep                | Sleep                   | RENAME     | Sleep Duration Goal              | Sleep                    | Sleep Duration            | Low                   | Avoid implying exactly eight hours suits everyone. Support a configurable target range.                           |
| sleep-bed-by-10pm              | Early Bedtime           | RENAME     | Consistent Bedtime               | Sleep                    | Sleep Schedule            | Low                   | A fixed 10 PM target is culturally and personally restrictive. Focus on consistency.                              |
| sleep-no-screen-1hr            | Screen-Free Hour        | KEEP       | Screen-Free Wind-Down            | Sleep                    | Sleep Preparation         | Low                   | Retain; allow 30–60 minute variations.                                                                            |
| sleep-power-nap                | Nap / Rest              | SPLIT      | Short Rest / Power Nap           | Sleep                    | Daytime Rest              | General caution       | Separate quiet rest from sleep if completion and guidance differ.                                                 |
| sleep-sleep-consistency        | Bedtime Routine         | KEEP       | Bedtime Routine                  | Sleep                    | Sleep Preparation         | Low                   | Retain and provide a clear wind-down protocol.                                                                    |
| sleep-wake-time                | Wake Up On Time         | MERGE      | Consistent Wake Time             | Sleep                    | Sleep Schedule            | Low                   | Merge with the duplicate habits wake-time activity.                                                               |
| mindfulness-5min-meditation    | Meditation              | RENAME     | 10-Minute Meditation             | Mindfulness              | Meditation                | Low                   | Current name and target conflict. Rename to match the stored target or revise the target during content build.    |
| mindfulness-10min-mindfulness  | Mindfulness             | MERGE      | Mindfulness Practice             | Mindfulness              | Mindfulness Practice      | Low                   | Merge into a clearer mindfulness family with duration variations.                                                 |
| mindfulness-20min-meditation   | Deep Meditation         | RENAME     | 20-Minute Meditation             | Mindfulness              | Meditation                | General caution       | Avoid implying depth from duration alone.                                                                         |
| mindfulness-gratitude-journal  | Gratitude Practice      | KEEP       | Gratitude Journal                | Mindfulness              | Gratitude                 | Low                   | Retain with specific prompts and a clear completion rule.                                                         |
| mindfulness-breathing-3x       | Breathing Exercise      | MERGE      | Calming Breathing                | Stress Management        | Breathing                 | Low                   | Merge with the duplicate stress deep-breathing activity.                                                          |
| mindfulness-digital-detox      | Digital Detox           | RENAME     | Device-Free Time                 | Mindfulness              | Digital Wellbeing         | Low                   | Use neutral, practical language and configurable duration.                                                        |
| mindfulness-body-scan          | Mindfulness Body Scan   | KEEP       | Body Scan Meditation             | Mindfulness              | Body Awareness            | Low                   | Retain with a specific guided protocol.                                                                           |
| mindfulness-prayer             | Prayer / Reflection     | KEEP       | Prayer or Quiet Reflection       | Mindfulness              | Reflection                | Low                   | Retain as an inclusive optional practice.                                                                         |
| mindfulness-journaling         | Journaling              | KEEP       | Daily Journaling                 | Mindfulness              | Reflection                | Low                   | Retain with flexible prompts and privacy-sensitive tracking.                                                      |
| nutrition-5-veg-servings       | Vegetable Intake        | RENAME     | Vegetable Servings               | Nutrition                | Vegetables                | Low                   | Fix the mismatch between the name and the current three-serving target; allow configurable goals.                 |
| nutrition-7-produce            | Fruit Intake            | RENAME     | Fruit Servings                   | Nutrition                | Fruit                     | Low                   | Remove the misleading '7 Produce' short name; allow configurable servings.                                        |
| nutrition-protein-goal         | Protein Intake          | RESTRICT   | Protein Goal                     | Nutrition                | Protein                   | Professional guidance | A fixed 100 g target is not suitable for everyone. Require personalization or professional advice.                |
| nutrition-no-sugar             | No Added Sugar          | RENAME     | Limit Added Sugar                | Nutrition                | Sugar Reduction           | General caution       | Avoid all-or-nothing wording. Use a realistic, measurable reduction behaviour.                                    |
| nutrition-whole-foods          | Balanced Meals          | RENAME     | Balanced Whole-Food Meals        | Nutrition                | Meal Quality              | Low                   | Retain with a practical meal composition guide.                                                                   |
| nutrition-meal-prep            | Meal Planning           | KEEP       | Weekly Meal Planning             | Nutrition                | Meal Planning             | Low                   | Retain; change frequency handling from daily to weekly.                                                           |
| nutrition-no-processed         | No Junk Food            | RENAME     | Reduce Ultra-Processed Foods     | Nutrition                | Food Quality              | Low                   | Use non-judgmental language and avoid absolute daily bans.                                                        |
| nutrition-breakfast            | Healthy Breakfast       | RENAME     | Nutritious First Meal            | Nutrition                | Meal Quality              | Low                   | Avoid implying everyone must eat breakfast, especially where fasting is supported.                                |
| nutrition-home-cooked          | Home-Cooked Meal        | KEEP       | Home-Cooked Meal                 | Nutrition                | Meal Preparation          | Low                   | Retain with practical, culturally flexible guidance.                                                              |
| fasting-16hr-fast              | Intermittent Fasting    | RENAME     | 16:8 Time-Restricted Eating      | Fasting & Meal Timing    | Time-Restricted Eating    | Professional guidance | Use a specific name and separate content, safety and suitability.                                                 |
| fasting-18hr-fast              | Extended Fasting        | RENAME     | 18:6 Time-Restricted Eating      | Fasting & Meal Timing    | Time-Restricted Eating    | Professional guidance | Do not call 18 hours extended fasting. Give it its own protocol and cautions.                                     |
| fasting-time-restricted        | Time-Restricted Eating  | RENAME     | 12-Hour Overnight Fast           | Fasting & Meal Timing    | Meal Timing               | General caution       | Make the actual 12-hour target explicit.                                                                          |
| fasting-no-late-eating         | No Late Eating          | RENAME     | Evening Eating Cut-Off           | Fasting & Meal Timing    | Meal Timing               | Low                   | Retain as a meal-timing habit rather than a fasting protocol.                                                     |
| —                              | —                       | ADD        | 14:10 Time-Restricted Eating     | Fasting & Meal Timing    | Time-Restricted Eating    | General caution       | Add as a clear step between 12-hour and 16-hour patterns.                                                         |
| —                              | —                       | ADD LATER  | 24-Hour Fast                     | Fasting & Meal Timing    | Longer Fasting            | Restricted            | Do not publish as a normal challenge until clinically reviewed.                                                   |
| —                              | —                       | ADD LATER  | 36–72 Hour Fasts                 | Fasting & Meal Timing    | Longer Fasting            | Restricted            | Keep out of ordinary public challenges; separate each duration if ever introduced.                                |
| habits-morning-routine         | Morning Routine         | KEEP       | Morning Routine                  | Habits & Personal Growth | Daily Routines            | Low                   | Retain, but allow users to define the routine components.                                                         |
| habits-evening-routine         | Evening Routine         | MERGE      | Evening Wind-Down Routine        | Sleep                    | Sleep Preparation         | Low                   | Merge conceptually with bedtime routine unless a distinct non-sleep use case is preserved.                        |
| habits-read-daily              | Reading                 | KEEP       | Daily Reading                    | Habits & Personal Growth | Learning                  | Low                   | Retain with configurable duration.                                                                                |
| habits-daily-planning          | Habit Check-In          | RENAME     | Daily Planning Check-In          | Habits & Personal Growth | Planning                  | Low                   | Current name and description are inconsistent.                                                                    |
| habits-wake-time               | Consistent Wake-Up      | MERGE      | Consistent Wake Time             | Sleep                    | Sleep Schedule            | Low                   | Merge with sleep wake-time activity.                                                                              |
| habits-no-late-snacks          | No Late-Night Snacking  | MERGE      | Evening Eating Cut-Off           | Fasting & Meal Timing    | Meal Timing               | Low                   | Merge with No Late Eating to avoid duplicate concepts.                                                            |
| habits-learning                | Learning                | KEEP       | Daily Learning                   | Habits & Personal Growth | Learning                  | Low                   | Retain with configurable duration and activity type.                                                              |
| habits-declutter               | Decluttering            | KEEP       | 10-Minute Declutter              | Habits & Personal Growth | Environment               | Low                   | Retain; make the expected action explicit.                                                                        |
| stress-breathing-3x            | Deep Breathing          | MERGE      | Calming Breathing                | Stress Management        | Breathing                 | Low                   | Merge with mindfulness breathing exercise.                                                                        |
| stress-nature-walk             | Nature Time             | RENAME     | Time in Nature                   | Stress Management        | Nature & Recovery         | Low                   | Allow walking or seated outdoor time rather than assuming a walk.                                                 |
| stress-stress-journal          | Stress Check-In         | KEEP       | Stress Check-In                  | Stress Management        | Self-Awareness            | Low                   | Retain; avoid diagnostic interpretation.                                                                          |
| stress-pmr                     | Relaxation Session      | RENAME     | Progressive Muscle Relaxation    | Stress Management        | Relaxation Techniques     | General caution       | Use the full technique name and specific protocol.                                                                |
| stress-box-breathing           | Breathing Protocol      | KEEP       | Box Breathing                    | Stress Management        | Breathing                 | General caution       | Retain as a distinct structured protocol.                                                                         |
| stress-unplug-break            | Unplug Break            | MERGE      | Device-Free Break                | Mindfulness              | Digital Wellbeing         | Low                   | Merge with Device-Free Time if the purpose and duration remain the same.                                          |
| stress-music-calm              | Music / Calm Time       | KEEP       | Calming Music Break              | Stress Management        | Relaxation                | Low                   | Retain with hearing-safety and context guidance where relevant.                                                   |
| social-daily-connection        | Social Connection       | KEEP       | Meaningful Daily Connection      | Social Wellbeing         | Connection                | Low                   | Retain with clear examples and privacy-sensitive tracking.                                                        |
| social-kindness-act            | Acts of Kindness        | KEEP       | Act of Kindness                  | Social Wellbeing         | Kindness & Service        | Low                   | Retain with non-performative, flexible examples.                                                                  |
| social-community-join          | Community Participation | KEEP       | Community Participation          | Social Wellbeing         | Community                 | Low                   | Retain as weekly rather than daily.                                                                               |
| social-call-someone            | Check In With Someone   | KEEP       | Check In With Someone            | Social Wellbeing         | Connection                | Low                   | Retain; broaden beyond phone calls.                                                                               |
| social-gratitude-message       | Gratitude Message       | KEEP       | Send a Gratitude Message         | Social Wellbeing         | Appreciation              | Low                   | Retain as a clear action.                                                                                         |
| social-family-time             | Family Time             | RENAME     | Device-Free Family Time          | Social Wellbeing         | Family Connection         | Low                   | Make the key behaviour explicit.                                                                                  |
| health-monitoring-weight-check | Weight Check            | RESTRICT   | Weight Check-In                  | Health Tracking          | Body Measurements         | Professional guidance | Private tracking only; no competitive ranking or automatic interpretation.                                        |
| health-monitoring-bp-check     | Blood Pressure Check    | RESTRICT   | Blood Pressure Check             | Health Tracking          | Vital Signs               | Professional guidance | Retain only with validated-device guidance, correct measurement protocol and escalation language.                 |
| health-monitoring-blood-sugar  | Blood Sugar Check       | RESTRICT   | Blood Glucose Check              | Health Tracking          | Glucose Monitoring        | Restricted            | Only for users directed to monitor; private, non-competitive and clinically reviewed.                             |
| health-monitoring-medication   | Medication Adherence    | RESTRICT   | Medication Reminder & Check-In   | Health Tracking          | Medication Support        | Restricted            | Never recommend medication changes. Require prescription-following language and privacy controls.                 |
| health-monitoring-appointment  | Health Appointment      | RENAME     | Health Appointment Check-In      | Health Tracking          | Care Follow-Up            | Low                   | Retain as a reminder and attendance log, not a medical outcome activity.                                          |


## Provisional outcome summary

- **ADD:** 1

- **ADD LATER:** 2

- **KEEP:** 23

- **MERGE:** 9

- **RECLASSIFY:** 2

- **RENAME:** 23

- **RESTRICT:** 6

- **RETIRE:** 1

- **SPLIT:** 3


## Key catalogue changes

- Fixed universal water targets are removed in favour of configurable hydration tracking.

- The misleading fasting names are replaced with explicit 12-hour, 14:10, 16:8 and 18:6 entries.

- Longer fasts are separated from ordinary time-restricted eating and held as restricted future content.

- Duplicate wake-time, breathing, late-eating and device-break activities are consolidated.

- Health tracking is separated from lifestyle challenges and barred from competitive use.

- Sleep timing, nutrition and movement activities are renamed so the expected action is clear.

## Next review sequence

Review and approve category by category in this order:

1. Movement and Recovery & Mobility

2. Hydration

3. Sleep

4. Mindfulness and Stress Management

5. Nutrition

6. Habits and Social Wellbeing

7. Fasting & Meal Timing

8. Health Tracking
