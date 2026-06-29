/*
  # Free-tier branding on public share pages

  Returns show_branding=true when the project owner is on the free plan so the
  share page can display "Made with Project Percent". Paid owners get no branding.
*/

CREATE OR REPLACE FUNCTION public.get_shared_project(p_public_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_user_id uuid;
  v_name text;
  v_description text;
  v_progress_percent integer;
  v_progress_color text;
  v_updated_at timestamptz;
  v_milestones jsonb;
  v_owner_plan text;
  v_show_branding boolean;
BEGIN
  IF p_public_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    p.id,
    p.user_id,
    p.name,
    p.description,
    p.progress_percent,
    p.progress_color,
    p.updated_at
  INTO
    v_project_id,
    v_user_id,
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

  SELECT COALESCE(plan, 'free')
  INTO v_owner_plan
  FROM public.user_profiles
  WHERE id = v_user_id;

  v_show_branding := COALESCE(v_owner_plan, 'free') = 'free';

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
    'milestones', v_milestones,
    'show_branding', v_show_branding
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_project(uuid) TO anon, authenticated;
