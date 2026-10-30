-- TIIZI-FER-P5T-1-001: governed Challenge Template authority.
--
-- Additive only. Existing Challenges keep working: the provenance columns on
-- `challenges` are nullable and no existing row is touched. Rollback (manual,
-- only while no Template has been adopted): drop the trigger/columns on
-- `challenges`, then the four tables below in reverse dependency order.
-- Published Template versions are immutable evidence; once Challenges carry
-- provenance, rolling back loses the "started from" record only.

-- Narrow, explicit, revocable Template-author roster (modelled on 023).
-- Grants are provisioned out-of-band; there is no self-service route.
-- Console read access (024) does NOT confer Template authorship.
CREATE TABLE IF NOT EXISTS platform_operator_template_authors (
  member_id UUID PRIMARY KEY REFERENCES members(member_id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grant_reference TEXT NOT NULL CHECK (char_length(btrim(grant_reference)) BETWEEN 8 AND 240),
  revoked_at TIMESTAMPTZ,
  revoked_reference TEXT,
  CHECK ((revoked_at IS NULL AND revoked_reference IS NULL)
      OR (revoked_at IS NOT NULL AND revoked_reference IS NOT NULL
          AND char_length(btrim(revoked_reference)) BETWEEN 8 AND 240))
);

-- Persistence-boundary authority: any actor named on a Template write must
-- be on the active roster at the moment of the write.
CREATE OR REPLACE FUNCTION assert_active_template_author(actor UUID, label TEXT)
RETURNS VOID AS $$
BEGIN
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM platform_operator_template_authors
    WHERE member_id = actor AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'template_author_required: % is not an active Template author', label
      USING ERRCODE = '42501';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS challenge_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'published', 'retired')),
  created_by_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when the first version is published; moves forward on each publish.
  latest_published_version INTEGER,
  latest_published_at TIMESTAMPTZ,
  retired_by_member_id UUID REFERENCES members(member_id) ON DELETE RESTRICT,
  retired_at TIMESTAMPTZ,
  retired_reason TEXT CHECK (retired_reason IS NULL OR char_length(btrim(retired_reason)) BETWEEN 1 AND 500),
  CHECK ((lifecycle = 'retired') = (retired_at IS NOT NULL AND retired_by_member_id IS NOT NULL)),
  CHECK (lifecycle <> 'published' OR latest_published_version IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS challenge_template_versions (
  template_id UUID NOT NULL REFERENCES challenge_templates(template_id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published')),
  -- Reusable configuration. A Template never stores instance-specific data:
  -- hosting Group, dates, timezone, membership, payment/Support fields.
  title TEXT,
  description TEXT,
  summary TEXT,
  challenge_type TEXT CHECK (challenge_type IS NULL OR challenge_type IN ('collective', 'competitive', 'streak')),
  duration_days INTEGER CHECK (duration_days IS NULL OR duration_days >= 1),
  duration_preset_days INTEGER[],
  cover_id TEXT,
  focus_tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Normalized Composer draft (mode TEMPLATE_AUTHORING) minus dates.
  composer_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Separate audit identities (FD-TPL-01): author, last editor, publisher.
  authored_by_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  authored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_edited_by_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by_member_id UUID REFERENCES members(member_id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ,
  PRIMARY KEY (template_id, version),
  CONSTRAINT challenge_template_versions_cover_check
    CHECK (cover_id IS NULL OR cover_id IN ('challenge-1','challenge-2','challenge-3','challenge-4','challenge-5','challenge-6','challenge-7','challenge-8')),
  -- A published version is complete; a draft may be incomplete.
  CONSTRAINT challenge_template_versions_published_complete CHECK (
    state = 'draft'
    OR (published_by_member_id IS NOT NULL AND published_at IS NOT NULL
        AND title IS NOT NULL AND char_length(btrim(title)) > 0
        AND summary IS NOT NULL AND char_length(btrim(summary)) > 0
        AND challenge_type IS NOT NULL AND duration_days IS NOT NULL)
  ),
  CONSTRAINT challenge_template_versions_draft_unpublished CHECK (
    state = 'published' OR (published_by_member_id IS NULL AND published_at IS NULL)
  )
);

-- At most one open draft per Template.
CREATE UNIQUE INDEX IF NOT EXISTS challenge_template_versions_one_draft
  ON challenge_template_versions (template_id) WHERE state = 'draft';
CREATE INDEX IF NOT EXISTS challenge_template_versions_published_type
  ON challenge_template_versions (challenge_type) WHERE state = 'published';

-- Append-only authoring/publication audit.
CREATE TABLE IF NOT EXISTS challenge_template_audit_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES challenge_templates(template_id) ON DELETE RESTRICT,
  version INTEGER,
  action TEXT NOT NULL CHECK (action IN ('create_draft', 'edit_draft', 'revise', 'publish', 'retire')),
  actor_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS challenge_template_audit_template
  ON challenge_template_audit_events (template_id, event_id);

CREATE OR REPLACE FUNCTION challenge_template_audit_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM assert_active_template_author(NEW.actor_member_id, 'audit actor');
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'template_audit_append_only: audit events cannot be changed or deleted'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_template_audit_guard_trg ON challenge_template_audit_events;
CREATE TRIGGER challenge_template_audit_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON challenge_template_audit_events
  FOR EACH ROW EXECUTE FUNCTION challenge_template_audit_guard();

CREATE OR REPLACE FUNCTION challenge_templates_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'template_immutable: Templates are never deleted (retire instead)'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM assert_active_template_author(NEW.created_by_member_id, 'template creator');
    IF NEW.lifecycle <> 'draft' OR NEW.latest_published_version IS NOT NULL THEN
      RAISE EXCEPTION 'template_immutable: Templates are created as drafts'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.lifecycle = 'retired' THEN
    RAISE EXCEPTION 'template_retired: a retired Template cannot change'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.template_id <> OLD.template_id OR NEW.created_by_member_id <> OLD.created_by_member_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'template_immutable: Template identity and creator are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.latest_published_version IS DISTINCT FROM OLD.latest_published_version THEN
    IF NEW.latest_published_version IS NULL
       OR (OLD.latest_published_version IS NOT NULL
           AND NEW.latest_published_version <= OLD.latest_published_version) THEN
      RAISE EXCEPTION 'template_immutable: published version pointer only moves forward'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.latest_published_version IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM challenge_template_versions
    WHERE template_id = NEW.template_id AND version = NEW.latest_published_version AND state = 'published'
  ) THEN
    RAISE EXCEPTION 'template_immutable: the published pointer must name a published version'
      USING ERRCODE = '23514';
  END IF;
  -- Lifecycle is forward-only: draft -> published -> retired.
  IF OLD.lifecycle = 'published' AND NEW.lifecycle = 'draft' THEN
    RAISE EXCEPTION 'template_immutable: lifecycle only moves forward'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.lifecycle = 'retired' AND OLD.lifecycle <> 'retired' THEN
    PERFORM assert_active_template_author(NEW.retired_by_member_id, 'template retirer');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_templates_guard_trg ON challenge_templates;
CREATE TRIGGER challenge_templates_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON challenge_templates
  FOR EACH ROW EXECUTE FUNCTION challenge_templates_guard();

CREATE OR REPLACE FUNCTION challenge_template_versions_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state = 'published' THEN
      RAISE EXCEPTION 'template_version_immutable: published versions cannot be deleted'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'draft' THEN
      RAISE EXCEPTION 'template_version_immutable: versions are created as drafts'
        USING ERRCODE = '23514';
    END IF;
    PERFORM assert_active_template_author(NEW.authored_by_member_id, 'version author');
    PERFORM assert_active_template_author(NEW.last_edited_by_member_id, 'version editor');
    IF EXISTS (SELECT 1 FROM challenge_templates WHERE template_id = NEW.template_id AND lifecycle = 'retired') THEN
      RAISE EXCEPTION 'template_retired: a retired Template cannot receive versions'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF OLD.state = 'published' THEN
    RAISE EXCEPTION 'template_version_immutable: a published version is an immutable snapshot'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.template_id <> OLD.template_id OR NEW.version <> OLD.version
     OR NEW.authored_by_member_id <> OLD.authored_by_member_id
     OR NEW.authored_at <> OLD.authored_at THEN
    RAISE EXCEPTION 'template_version_immutable: version identity and author are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM challenge_templates WHERE template_id = NEW.template_id AND lifecycle = 'retired') THEN
    RAISE EXCEPTION 'template_retired: a retired Template cannot change'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.state = 'published' THEN
    -- Publication is a pure state transition: no content may change with it,
    -- and the publisher (not the earlier editor) must be an active author.
    IF ROW(NEW.title, NEW.description, NEW.summary, NEW.challenge_type, NEW.duration_days,
           NEW.duration_preset_days, NEW.cover_id, NEW.focus_tags, NEW.sort_order, NEW.composer_config,
           NEW.last_edited_by_member_id, NEW.last_edited_at)
       IS DISTINCT FROM
       ROW(OLD.title, OLD.description, OLD.summary, OLD.challenge_type, OLD.duration_days,
           OLD.duration_preset_days, OLD.cover_id, OLD.focus_tags, OLD.sort_order, OLD.composer_config,
           OLD.last_edited_by_member_id, OLD.last_edited_at) THEN
      RAISE EXCEPTION 'template_version_immutable: content cannot change while publishing'
        USING ERRCODE = '23514';
    END IF;
    PERFORM assert_active_template_author(NEW.published_by_member_id, 'version publisher');
  ELSE
    -- Any draft edit names an active author as editor.
    PERFORM assert_active_template_author(NEW.last_edited_by_member_id, 'version editor');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_template_versions_guard_trg ON challenge_template_versions;
CREATE TRIGGER challenge_template_versions_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON challenge_template_versions
  FOR EACH ROW EXECUTE FUNCTION challenge_template_versions_guard();

-- Internal provenance on established Challenges (FD-TPL-03). Nullable:
-- Challenges established from scratch and all pre-existing Challenges carry
-- none. Never shown to members; never read by engine/scoring/permissions.
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS source_template_id UUID,
  ADD COLUMN IF NOT EXISTS source_template_version INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenges_source_template_pair_check') THEN
    ALTER TABLE challenges ADD CONSTRAINT challenges_source_template_pair_check
      CHECK ((source_template_id IS NULL) = (source_template_version IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenges_source_template_fk') THEN
    ALTER TABLE challenges ADD CONSTRAINT challenges_source_template_fk
      FOREIGN KEY (source_template_id, source_template_version)
      REFERENCES challenge_template_versions (template_id, version) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS challenges_source_template_idx
  ON challenges (source_template_id, source_template_version)
  WHERE source_template_id IS NOT NULL;

-- Note: retirement is deliberately enforced by the establishing transaction
-- (after the idempotency claim) rather than here, so a retry of an already
-- established Challenge can still replay after its Template was retired.
CREATE OR REPLACE FUNCTION challenges_template_provenance_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.source_template_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM challenge_template_versions
      WHERE template_id = NEW.source_template_id AND version = NEW.source_template_version
        AND state = 'published'
    ) THEN
      RAISE EXCEPTION 'template_reference_invalid: provenance must name a published Template version'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.source_template_id IS DISTINCT FROM OLD.source_template_id
     OR NEW.source_template_version IS DISTINCT FROM OLD.source_template_version THEN
    RAISE EXCEPTION 'template_provenance_immutable: Challenge Template provenance is written once'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenges_template_provenance_guard_trg ON challenges;
CREATE TRIGGER challenges_template_provenance_guard_trg
  BEFORE INSERT OR UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION challenges_template_provenance_guard();
