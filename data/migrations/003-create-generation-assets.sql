-- Migration: create generation_tasks and assets tables

CREATE TABLE IF NOT EXISTS generation_tasks (
    id SERIAL PRIMARY KEY,
    task_id TEXT UNIQUE NOT NULL,
    user_uuid TEXT NOT NULL,
    request_type INT NOT NULL,
    model_version TEXT NOT NULL,
    resolution TEXT,
    face INT,
    format INT,
    state TEXT NOT NULL DEFAULT 'created',
    hitem3d_cover_url TEXT,
    hitem3d_file_url TEXT,
    credits_charged INT NOT NULL DEFAULT 0,
    refunded BOOLEAN NOT NULL DEFAULT false,
    error TEXT,
    callback_received_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    user_uuid TEXT NOT NULL,
    task_id TEXT,
    title TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    cover_key TEXT,
    cover_url TEXT,
    file_key_full TEXT,
    file_key_preview TEXT,
    file_format TEXT,
    face_count INT,
    size_bytes BIGINT,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at timestamptz,
    updated_at timestamptz
);

-- Rollback (manual):
-- DROP TABLE IF EXISTS assets;
-- DROP TABLE IF EXISTS generation_tasks;

