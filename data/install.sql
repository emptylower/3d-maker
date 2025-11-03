CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at timestamptz,
    nickname VARCHAR(255),
    avatar_url VARCHAR(255),
    password_hash TEXT,
    password_salt TEXT,
    locale VARCHAR(50),
    signin_type VARCHAR(50),
    signin_ip VARCHAR(255),
    signin_provider VARCHAR(50),
    signin_openid VARCHAR(255),
    invite_code VARCHAR(255) NOT NULL default '',
    updated_at timestamptz,
    invited_by VARCHAR(255) NOT NULL default '',
    is_affiliate BOOLEAN NOT NULL default false,
    UNIQUE (email, signin_provider)
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(255) UNIQUE NOT NULL,
    created_at timestamptz,
    user_uuid VARCHAR(255) NOT NULL DEFAULT '',
    user_email VARCHAR(255) NOT NULL DEFAULT '',
    amount INT NOT NULL,
    interval VARCHAR(50),
    expired_at timestamptz,
    status VARCHAR(50) NOT NULL,
    stripe_session_id VARCHAR(255),
    credits INT NOT NULL,
    currency VARCHAR(50),
    sub_id VARCHAR(255),
    sub_interval_count int,
    sub_cycle_anchor int,
    sub_period_end int,
    sub_period_start int,
    sub_times int,
    product_id VARCHAR(255),
    product_name VARCHAR(255),
    valid_months int,
    order_detail TEXT,
    paid_at timestamptz,
    paid_email VARCHAR(255),
    paid_detail TEXT
);


CREATE TABLE apikeys (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(100),
    user_uuid VARCHAR(255) NOT NULL,
    created_at timestamptz,
    status VARCHAR(50)
);

CREATE TABLE credits (
    id SERIAL PRIMARY KEY,
    trans_no VARCHAR(255) UNIQUE NOT NULL,
    created_at timestamptz,
    user_uuid VARCHAR(255) NOT NULL,
    trans_type VARCHAR(50) NOT NULL,
    credits INT NOT NULL,
    order_no VARCHAR(255),
    expired_at timestamptz
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    content TEXT,
    created_at timestamptz,
    updated_at timestamptz,
    status VARCHAR(50),
    cover_url VARCHAR(255),
    author_name VARCHAR(255),
    author_avatar_url VARCHAR(255),
    locale VARCHAR(50)
);

create table affiliates (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) NOT NULL,
    created_at timestamptz,
    status VARCHAR(50) NOT NULL default '',
    invited_by VARCHAR(255) NOT NULL,
    paid_order_no VARCHAR(255) NOT NULL default '',
    paid_amount INT NOT NULL default 0,
    reward_percent INT NOT NULL default 0,
    reward_amount INT NOT NULL default 0
);

-- Generation tasks for hitem3D submissions
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

-- Assets generated from tasks
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

-- Vouchers for credits redeem
CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    credits INT DEFAULT 0,
    valid_months INT DEFAULT 0,
    plan_id TEXT,
    expires_at timestamptz,
    max_redemptions INT DEFAULT 1,
    used_count INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    issued_by TEXT,
    created_at timestamptz
);

-- Voucher redemption records
CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    redeemed_at timestamptz,
    result JSONB
);

-- Publications (plaza posts from assets)
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

-- Reports for publications
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    publication_id INT NOT NULL,
    user_uuid TEXT,
    reason TEXT,
    created_at timestamptz
);
