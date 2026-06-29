/*
  # Add public shareable project links

  Adds is_public + share_token columns to projects and RPC functions for:
  - Owner-controlled sharing toggle (premium-gated)
  - Anonymous read-only access via share token
*/

-- ── Schema ────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS projects_share_token_unique_idx
  ON public.projects (share_token)
  WHERE share_token IS NOT NULL;

-- Prevent direct client writes to sharing fields; only RPCs may change them.
REVOKE UPDATE (is_public, share_token)
  ON public.projects FROM authenticated;

-- ── Public read via share token ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_shared_project(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_milestones jsonb;
BEGIN
  IF p_share_token IS NULL OR length(trim(p_share_token)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects
  WHERE share_token = p_share_token
    AND is_public = true
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', m.title,
        'description', m.description,
        'is_complete', m.is_complete,
        'created_at', m.created_at
      )
      ORDER BY m.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_milestones
  FROM public.milestones m
  WHERE m.project_id = v_project.id
    AND m.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'name', v_project.name,
    'description', v_project.description,
    'progress_percent', v_project.progress_percent,
    'progress_color', v_project.progress_color,
    'updated_at', v_project.updated_at,
    'milestones', v_milestones
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_project(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_project(text) TO anon, authenticated;

-- ── Owner sharing toggle (premium-gated) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_project_sharing(
  p_project_id uuid,
  p_is_public boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan text;
  v_token text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_is_public THEN
    SELECT plan
    INTO v_plan
    FROM public.user_profiles
    WHERE id = v_uid;

    IF v_plan IS DISTINCT FROM 'premium' THEN
      RAISE EXCEPTION 'Premium plan required for public sharing';
    END IF;
  END IF;

  IF p_is_public THEN
    UPDATE public.projects
    SET
      is_public = true,
      share_token = coalesce(share_token, encode(gen_random_bytes(16), 'hex'))
    WHERE id = p_project_id
      AND user_id = v_uid
      AND deleted_at IS NULL
    RETURNING share_token INTO v_token;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    RETURN v_token;
  END IF;

  UPDATE public.projects
  SET is_public = false
  WHERE id = p_project_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_sharing(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_sharing(uuid, boolean) TO authenticated;
