-- PF-01: two canonical governed V2 exemplar Activities.
--
-- These are real governed records, not placeholder preview data. Each
-- satisfies the KCS minima applicable to its classes (provable through the
-- application gate: assessPublicationReadiness returns no issues) and
-- carries a governed Metric/Unit contract.
--
-- Content mirrors api/src/pf01Exemplars.ts (PUSH_UP_EXEMPLAR /
-- BREATHING_PRACTICE_EXEMPLAR). Any change must update both.
--
-- 1. FIT-STR-001 Push-Up (fitness technique exemplar, U+Q+T+S):
--    technique-bearing physical activity, repetitions.
-- 2. WEL-MND-003 Breathing Practice (wellness protocol exemplar, U+Q+P+C+S):
--    protocol/completion-bearing wellness activity, duration + completion.
--    Safety content is general practice caution only; no clinical claims.
--
-- Both are inserted directly as published version 1 with matching immutable
-- version rows. No bulk catalogue is authored here.

-- 1. Push-Up ----------------------------------------------------------------
INSERT INTO knowledge_items (
  knowledge_id, kind, activity_code, lifecycle, current_version,
  name, category, subcategory, difficulty, icon, description,
  metric_unit, target_value, target_type, frequency, points, image_url, tags, details,
  content_classes, default_locale, grandfathered,
  primary_metrics, secondary_metrics, compatible_units,
  measurement_guidance, unit_semantics, setup, execution, technique_reference,
  form_cues, common_mistakes, equipment, environment, adaptation,
  protocol_steps, session_framing, completion_meaning, avoidance_condition,
  semantic_definition, safety_notes
) VALUES (
  '11111111-1111-4111-8111-111111111111', 'fitness', 'FIT-STR-001', 'published', 1,
  'Push-Up', 'Strength', 'Push', 'Intermediate', '', 'A foundational bodyweight pushing movement performed from a plank position, lowering the chest toward the floor and pressing back up.',
  'reps', NULL, '', '', 0, '', '{}', '{}',
  ARRAY['U','Q','T'], 'en', FALSE,
  ARRAY['repetitions'], '{}', ARRAY['reps'],
  'Count one repetition for each full controlled lowering and press back to the starting plank. Report total repetitions per session.',
  'One rep equals one complete down-and-up cycle counted when the chest lowers with control and the arms fully extend without resting on the floor.',
  'Start in a high plank with hands under shoulders, body in a straight line from head to heels, core braced.',
  'Lower the chest toward the floor by bending the elbows close to the body, then press through the palms to full arm extension while keeping the body straight.',
  '',
  ARRAY['Keep your body in a straight line', 'Brace your core throughout', 'Lower with control; do not drop'],
  ARRAY['Hips sagging or piking', 'Flaring the elbows wide', 'Partial range of motion'],
  'None required', 'Flat stable floor surface with enough space to lie prone', 'Beginners may perform incline push-ups against a raised surface or from the knees while keeping the trunk straight.',
  '[]', '', '', '',
  '',
  ARRAY['Stop if you feel sharp pain in shoulders, wrists or lower back', 'Keep wrists stacked under shoulders to avoid strain']
);

INSERT INTO knowledge_item_versions (
  item_id, version, name, category, subcategory, difficulty, icon, description,
  metric_unit, target_value, target_type, frequency, points, image_url, tags, details,
  measurement_guidance, unit_semantics, setup, execution, technique_reference,
  form_cues, common_mistakes, equipment, environment, adaptation,
  protocol_steps, session_framing, completion_meaning, avoidance_condition,
  semantic_definition, safety_notes,
  content_classes, primary_metrics, secondary_metrics, compatible_units
) VALUES (
  '11111111-1111-4111-8111-111111111111', 1, 'Push-Up', 'Strength', 'Push', 'Intermediate', '', 'A foundational bodyweight pushing movement performed from a plank position, lowering the chest toward the floor and pressing back up.',
  'reps', NULL, '', '', 0, '', '{}', '{}',
  'Count one repetition for each full controlled lowering and press back to the starting plank. Report total repetitions per session.',
  'One rep equals one complete down-and-up cycle counted when the chest lowers with control and the arms fully extend without resting on the floor.',
  'Start in a high plank with hands under shoulders, body in a straight line from head to heels, core braced.',
  'Lower the chest toward the floor by bending the elbows close to the body, then press through the palms to full arm extension while keeping the body straight.',
  '',
  ARRAY['Keep your body in a straight line', 'Brace your core throughout', 'Lower with control; do not drop'],
  ARRAY['Hips sagging or piking', 'Flaring the elbows wide', 'Partial range of motion'],
  'None required', 'Flat stable floor surface with enough space to lie prone', 'Beginners may perform incline push-ups against a raised surface or from the knees while keeping the trunk straight.',
  '[]', '', '', '',
  '',
  ARRAY['Stop if you feel sharp pain in shoulders, wrists or lower back', 'Keep wrists stacked under shoulders to avoid strain'],
  ARRAY['U','Q','T'], ARRAY['repetitions'], '{}', ARRAY['reps']
);

-- 2. Breathing Practice ------------------------------------------------------
INSERT INTO knowledge_items (
  knowledge_id, kind, activity_code, lifecycle, current_version,
  name, category, subcategory, difficulty, icon, description,
  metric_unit, target_value, target_type, frequency, points, image_url, tags, details,
  content_classes, default_locale, grandfathered,
  primary_metrics, secondary_metrics, compatible_units,
  measurement_guidance, unit_semantics, setup, execution, technique_reference,
  form_cues, common_mistakes, equipment, environment, adaptation,
  protocol_steps, session_framing, completion_meaning, avoidance_condition,
  semantic_definition, safety_notes
) VALUES (
  '22222222-2222-4222-8222-222222222222', 'wellness', 'WEL-MND-003', 'published', 1,
  'Breathing Practice', 'Mind & Emotional Wellbeing', 'Mind-Body Practice', 'beginner', '', 'A guided slow-breathing session practiced seated or lying down, following a simple inhale-hold-exhale rhythm.',
  'minutes', NULL, '', '', 0, '', '{}', '{}',
  ARRAY['U','Q','P','C','S'], 'en', FALSE,
  ARRAY['completion','duration'], '{}', ARRAY['completion','minutes','seconds'],
  'Report session length in whole minutes, or mark the session complete when the guided protocol is finished, whichever the challenge tracks.',
  'One minute equals sixty seconds of guided practice; completion means the full protocol below was followed to its end.',
  '', '', '',
  '{}', '{}', '', '', '',
  '["Sit or lie down in a comfortable position with the back supported.", "Breathe in slowly through the nose for a count of four.", "Hold gently for a count of four.", "Breathe out slowly through the mouth for a count of six.", "Repeat the cycle for the chosen session length, then breathe normally."]',
  'A quiet seated or lying session of slow guided breathing, practiced at rest.',
  'A session counts as complete when every protocol step above has been followed through to the final normal breath.',
  '', '',
  ARRAY['Practice seated or lying down in a safe place', 'Stop and breathe normally if you feel dizzy or uncomfortable']
);

INSERT INTO knowledge_item_versions (
  item_id, version, name, category, subcategory, difficulty, icon, description,
  metric_unit, target_value, target_type, frequency, points, image_url, tags, details,
  measurement_guidance, unit_semantics, setup, execution, technique_reference,
  form_cues, common_mistakes, equipment, environment, adaptation,
  protocol_steps, session_framing, completion_meaning, avoidance_condition,
  semantic_definition, safety_notes,
  content_classes, primary_metrics, secondary_metrics, compatible_units
) VALUES (
  '22222222-2222-4222-8222-222222222222', 1, 'Breathing Practice', 'Mind & Emotional Wellbeing', 'Mind-Body Practice', 'beginner', '', 'A guided slow-breathing session practiced seated or lying down, following a simple inhale-hold-exhale rhythm.',
  'minutes', NULL, '', '', 0, '', '{}', '{}',
  'Report session length in whole minutes, or mark the session complete when the guided protocol is finished, whichever the challenge tracks.',
  'One minute equals sixty seconds of guided practice; completion means the full protocol below was followed to its end.',
  '', '', '',
  '{}', '{}', '', '', '',
  '["Sit or lie down in a comfortable position with the back supported.", "Breathe in slowly through the nose for a count of four.", "Hold gently for a count of four.", "Breathe out slowly through the mouth for a count of six.", "Repeat the cycle for the chosen session length, then breathe normally."]',
  'A quiet seated or lying session of slow guided breathing, practiced at rest.',
  'A session counts as complete when every protocol step above has been followed through to the final normal breath.',
  '', '',
  ARRAY['Practice seated or lying down in a safe place', 'Stop and breathe normally if you feel dizzy or uncomfortable'],
  ARRAY['U','Q','P','C','S'], ARRAY['completion','duration'], '{}', ARRAY['completion','minutes','seconds']
);
