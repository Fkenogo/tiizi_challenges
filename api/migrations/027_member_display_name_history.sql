CREATE TABLE member_display_name_history (
  history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  actor_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  old_display_name TEXT,
  new_display_name TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  source TEXT NOT NULL DEFAULT 'profile_self_edit',
  CONSTRAINT member_display_name_history_self_actor_check CHECK (actor_member_id = member_id),
  CONSTRAINT member_display_name_history_new_name_check CHECK (
    new_display_name = btrim(new_display_name)
    AND char_length(new_display_name) BETWEEN 1 AND 120
    AND new_display_name !~ '[[:cntrl:]]'
  ),
  CONSTRAINT member_display_name_history_old_name_check CHECK (
    old_display_name IS NULL OR (
      old_display_name = btrim(old_display_name)
      AND char_length(old_display_name) BETWEEN 1 AND 120
      AND old_display_name !~ '[[:cntrl:]]'
    )
  ),
  CONSTRAINT member_display_name_history_changed_check CHECK (
    old_display_name IS DISTINCT FROM new_display_name
  ),
  CONSTRAINT member_display_name_history_source_check CHECK (source = 'profile_self_edit')
);

CREATE INDEX member_display_name_history_member_order_idx
  ON member_display_name_history (member_id, history_id);

CREATE FUNCTION tiizi_reject_member_display_name_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'member display-name history is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER member_display_name_history_append_only
  BEFORE UPDATE OR DELETE ON member_display_name_history
  FOR EACH ROW EXECUTE FUNCTION tiizi_reject_member_display_name_history_mutation();
