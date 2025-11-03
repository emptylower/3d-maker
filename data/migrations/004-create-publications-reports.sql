-- Migration: create publications and reports tables

CREATE TABLE IF NOT EXISTS publications (
    id SERIAL PRIMARY KEY,
    asset_uuid TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    title TEXT,
    description TEXT,
    preview_key TEXT,
    printed_photos_count INT NOT NULL DEFAULT 0,
    contact_email TEXT,
    contact_tel TEXT,
    contact_wechat TEXT,
    contact_qq TEXT,
    slug TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'online',
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    publication_id INT NOT NULL,
    user_uuid TEXT,
    reason TEXT,
    created_at timestamptz
);

