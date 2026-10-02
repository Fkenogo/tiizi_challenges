-- Founder-authorized Challenge creation truth: curated cover and support configuration.
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS cover_id TEXT,
  ADD COLUMN IF NOT EXISTS support_tiizi_enabled BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenges_cover_catalogue_check') THEN
    ALTER TABLE challenges ADD CONSTRAINT challenges_cover_catalogue_check
      CHECK (cover_id IS NULL OR cover_id IN ('challenge-1','challenge-2','challenge-3','challenge-4','challenge-5','challenge-6','challenge-7','challenge-8'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS challenge_social_causes (
  challenge_id UUID PRIMARY KEY REFERENCES challenges(challenge_id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  purpose TEXT NOT NULL CHECK (char_length(purpose) BETWEEN 1 AND 500),
  beneficiary TEXT NOT NULL CHECK (char_length(beneficiary) BETWEEN 1 AND 200),
  payment_destination_reference TEXT NOT NULL CHECK (char_length(payment_destination_reference) BETWEEN 1 AND 300),
  destination_owner TEXT NOT NULL CHECK (destination_owner = 'beneficiary'),
  approval_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval','approved','revision_required','removed')),
  approval_authority UUID REFERENCES members(member_id) ON DELETE RESTRICT,
  decision_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((approval_status IN ('pending_approval','removed') AND approval_authority IS NULL AND decision_at IS NULL)
    OR (approval_status IN ('approved','revision_required') AND approval_authority IS NOT NULL AND decision_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS challenge_social_cause_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenge_social_causes(challenge_id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','revision_required')),
  authority_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS challenge_social_cause_decisions_challenge_idx ON challenge_social_cause_decisions(challenge_id, decided_at DESC);

CREATE OR REPLACE FUNCTION challenge_cause_activation_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active'
     AND EXISTS (SELECT 1 FROM challenge_social_causes c WHERE c.challenge_id = NEW.challenge_id AND c.approval_status NOT IN ('approved','removed')) THEN
    RAISE EXCEPTION 'challenge requires approved Social Cause before activation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS challenge_cause_activation_guard_trigger ON challenges;
CREATE TRIGGER challenge_cause_activation_guard_trigger BEFORE UPDATE OF status ON challenges
  FOR EACH ROW EXECUTE FUNCTION challenge_cause_activation_guard();

CREATE OR REPLACE FUNCTION challenge_cause_material_change_resets_approval() RETURNS trigger AS $$
BEGIN
  IF OLD.approval_status = 'approved' AND (
    OLD.beneficiary IS DISTINCT FROM NEW.beneficiary OR
    OLD.payment_destination_reference IS DISTINCT FROM NEW.payment_destination_reference
  ) THEN
    NEW.approval_status := 'pending_approval';
    NEW.approval_authority := NULL;
    NEW.decision_at := NULL;
    NEW.decision_reason := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS challenge_cause_material_change_resets_approval_trigger ON challenge_social_causes;
CREATE TRIGGER challenge_cause_material_change_resets_approval_trigger BEFORE UPDATE ON challenge_social_causes
  FOR EACH ROW EXECUTE FUNCTION challenge_cause_material_change_resets_approval();
