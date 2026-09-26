-- The clean V2 baseline does not import or reconcile legacy Firestore rows.
-- Remove migration 019's importer-only timestamp preservation bypass so every
-- Group and Membership update follows the ordinary updated_at trigger.
CREATE OR REPLACE FUNCTION tiizi_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
