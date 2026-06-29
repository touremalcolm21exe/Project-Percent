/*
  # Add public shareable project links

  Adds is_public + public_id columns to projects and RPC functions for:
  - Owner-controlled sharing toggle (premium-gated)
  - Anonymous read-only access via stable /share/{public_id} URLs

  public_id is a non-guessable UUID, separate from the internal project id.
*/

-- ── Schema ────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS projects_public_id_unique_idx
  ON public.projects (public_id)
  WHERE public_id IS NOT NULL;

-- Prevent direct client writes to sharing fields; only RPCs may change them.
REVOKE UPDATE (is_public, public_id)
  ON public.projects FROM authenticated;

-- ── Public read via public_id (read-only, non-sensitive fields only) ──────────
--
-- Sensitive fields intentionally excluded from the response:
--   projects.id, projects.user_id, projects.public_id, projects.is_public,
--   projects.created_at, projects.deleted_at
--   milestones.id, milestones.project_id, milestones.created_at,
--   milestones.updated_at, milestones.deleted_at

CREATE OR REPLACE FUNCTION public.get_shared_project(p_public_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_name text;
  v_description text;
  v_progress_percent integer;
  v_progress_color text;
  v_updated_at timestamptz;
  v_milestones jsonb;
BEGIN
  IF p_public_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    p.id,
    p.name,
    p.description,
    p.progress_percent,
    p.progress_color,
    p.updated_at
  INTO
    v_project_id,
    v_name,
    v_description,
    v_progress_percent,
    v_progress_color,
    v_updated_at
  FROM public.projects p
  WHERE p.public_id = p_public_id
    AND p.is_public = true
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', m.title,
        'description', m.description,
        'is_complete', m.is_complete
      )
      ORDER BY m.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_milestones
  FROM public.milestones m
  WHERE m.project_id = v_project_id
    AND m.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'name', v_name,
    'description', v_description,
    'progress_percent', v_progress_percent,
    'progress_color', v_progress_color,
    'updated_at', v_updated_at,
    'milestones', v_milestones
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_project(uuid) TO anon, authenticated;

-- ── Owner sharing toggle (premium-gated) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_project_sharing(
  p_project_id uuid,
  p_is_public boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan text;
  v_public_id uuid;
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
      public_id = coalesce(public_id, gen_random_uuid())
    WHERE id = p_project_id
      AND user_id = v_uid
      AND deleted_at IS NULL
    RETURNING public_id INTO v_public_id;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    RETURN v_public_id;
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
