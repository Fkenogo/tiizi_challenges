-- Phase A foundation: internal member identity, groups, group memberships.
-- Standard PostgreSQL only. No provider-specific features.
-- Firestore remains authoritative; these tables are a shadow/read model.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS members (
  member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT members_auth_identity_unique UNIQUE (auth_provider, auth_subject),
  CONSTRAINT members_auth_provider_check CHECK (char_length(auth_provider) BETWEEN 1 AND 64),
  CONSTRAINT members_auth_subject_check CHECK (char_length(auth_subject) BETWEEN 1 AND 256)
);

CREATE TABLE IF NOT EXISTS groups (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_firestore_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_name_check CHECK (char_length(name) BETWEEN 1 AND 200)
);

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id UUID NOT NULL REFERENCES groups (group_id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_memberships_unique UNIQUE (group_id, member_id),
  CONSTRAINT group_memberships_role_check CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT group_memberships_status_check CHECK (status IN ('joined', 'active', 'pending', 'rejected', 'left'))
);

CREATE INDEX IF NOT EXISTS group_memberships_member_idx ON group_memberships (member_id);
