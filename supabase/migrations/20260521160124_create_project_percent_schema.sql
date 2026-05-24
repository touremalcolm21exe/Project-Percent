/*
  # Project Percent - Initial Schema

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, required)
      - `description` (text, optional)
      - `progress_percent` (integer, 0-100, computed and stored)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `milestones`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `title` (text, required)
      - `is_complete` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Users can only access their own projects
    - Users can only access milestones belonging to their projects

  3. Automation
    - Trigger to auto-update `progress_percent` on projects whenever milestones change
    - Trigger to auto-update `updated_at` on both tables
*/

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  progress_percent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS milestones_project_id_idx ON milestones(project_id);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Milestones policies (check ownership via projects table)
CREATE POLICY "Users can view milestones of own projects"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert milestones into own projects"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update milestones of own projects"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete milestones of own projects"
  ON milestones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Function to recalculate progress_percent for a project
CREATE OR REPLACE FUNCTION recalculate_project_progress(p_project_id uuid)
RETURNS void AS $$
DECLARE
  total_count integer;
  complete_count integer;
  new_percent integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_complete = true)
  INTO total_count, complete_count
  FROM milestones
  WHERE project_id = p_project_id;

  IF total_count = 0 THEN
    new_percent := 0;
  ELSE
    new_percent := ROUND((complete_count::numeric / total_count::numeric) * 100);
  END IF;

  UPDATE projects
  SET progress_percent = new_percent,
      updated_at = now()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for milestone changes
CREATE OR REPLACE FUNCTION trigger_recalculate_progress()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_project_progress(OLD.project_id);
  ELSE
    PERFORM recalculate_project_progress(NEW.project_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to milestones
DROP TRIGGER IF EXISTS milestones_progress_trigger ON milestones;
CREATE TRIGGER milestones_progress_trigger
  AFTER INSERT OR UPDATE OR DELETE ON milestones
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_progress();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at triggers
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS milestones_updated_at ON milestones;
CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
