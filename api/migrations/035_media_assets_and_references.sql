-- TIIZI-V2-MEDIA-002 — Durable media ownership, upload intents, and canonical entity references.
--
-- Keeps PostgreSQL as domain authority for image ownership, lifecycle state,
-- and entity references while Cloudflare R2 stores private object bytes.
-- Provider URLs and signed URLs are never persisted in PostgreSQL.

CREATE TABLE IF NOT EXISTS media_assets (
  asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_scope TEXT NOT NULL CHECK (owner_scope IN ('member', 'group', 'challenge')),
  owner_id UUID,
  purpose TEXT NOT NULL CHECK (purpose IN ('profile_image', 'group_cover', 'challenge_cover')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'replaced', 'delete_pending', 'deleted', 'rejected')),
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/webp', 'image/jpeg', 'image/png')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  uploaded_by_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed_at TIMESTAMPTZ,
  delete_after TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS media_assets_owner_idx
  ON media_assets (owner_scope, owner_id, status);

CREATE INDEX IF NOT EXISTS media_assets_cleanup_idx
  ON media_assets (status, delete_after)
  WHERE delete_after IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_upload_intents (
  intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('profile_image', 'group_cover', 'challenge_cover')),
  target_scope_id UUID,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'uploaded', 'bound', 'expired', 'cancelled')),
  asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_upload_intents_actor_idem_uq UNIQUE (actor_member_id, purpose, idempotency_key)
);

CREATE INDEX IF NOT EXISTS media_upload_intents_actor_idx
  ON media_upload_intents (actor_member_id, created_at);

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS profile_image_asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS cover_asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL;

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS cover_asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL;

-- Ensure the least-privileged runtime role can read/write media ownership and
-- intent records without granting DDL, role creation, or RLS bypass.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tiizi_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON media_assets, media_upload_intents TO tiizi_runtime;
  END IF;
END
$$;
