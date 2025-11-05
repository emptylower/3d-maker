-- Migration: create asset_renditions table for on-demand exports

CREATE TABLE IF NOT EXISTS asset_renditions (
  id SERIAL PRIMARY KEY,
  asset_uuid TEXT NOT NULL,
  format TEXT NOT NULL,                -- obj|glb|stl|fbx
  with_texture BOOLEAN NOT NULL DEFAULT false,
  state TEXT NOT NULL DEFAULT 'created', -- created|processing|success|failed
  task_id TEXT,
  file_key TEXT,
  credits_charged INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(asset_uuid, format, with_texture)
);

-- Optional RLS (enable and allow service role). If you enabled RLS globally, uncomment and adapt:
-- ALTER TABLE asset_renditions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "asset_renditions_select_own" ON asset_renditions
--   FOR SELECT USING (
--     -- adapt this to your auth schema if needed
--     true
--   );

