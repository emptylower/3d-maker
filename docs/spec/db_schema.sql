-- Supabase Postgres schema proposal (MVP)

-- Users are managed by Supabase Auth (auth.users). We'll mirror minimal profile info.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user', -- 'user' | 'admin'
  created_at timestamptz not null default now()
);

create table if not exists public.credits_wallet (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.credits_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('register_bonus','purchase','model_task','refund','admin_adjust')),
  external_ref text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_user_time on public.credits_ledger(user_id, created_at desc);

create table if not exists public.model_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','processing','succeeded','failed')),
  hitem_task_id text,
  request_payload jsonb not null,
  hitem_model_urls jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_user_time on public.model_tasks(user_id, created_at desc);
create index if not exists idx_tasks_hitem on public.model_tasks(hitem_task_id);

create table if not exists public.model_assets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.model_tasks(id) on delete cascade,
  asset_type text not null check (asset_type in ('glb','obj','preview_image')),
  url text not null,
  metadata jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_assets_task on public.model_assets(task_id);

create table if not exists public.showcase_posts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.model_tasks(id) on delete set null,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  asset_url text not null,
  status text not null default 'published' check (status in ('published','removed')),
  removed_by uuid references auth.users(id),
  removed_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_status_time on public.showcase_posts(status, created_at desc);

create table if not exists public.stripe_events (
  event_id text primary key,
  payload jsonb not null,
  processed_at timestamptz
);

create table if not exists public.admin_flags (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','task')),
  target_id uuid not null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.credits_wallet enable row level security;
alter table public.credits_ledger enable row level security;
alter table public.model_tasks enable row level security;
alter table public.model_assets enable row level security;
alter table public.showcase_posts enable row level security;

-- Policies
-- profiles: user can read own profile; public read optional（此处默认不可）
create policy if not exists profiles_select_self on public.profiles for select using (auth.uid() = user_id);
create policy if not exists profiles_upsert_self on public.profiles for insert with check (auth.uid() = user_id);
create policy if not exists profiles_update_self on public.profiles for update using (auth.uid() = user_id);

-- credits_wallet: only owner can read
create policy if not exists wallet_select_self on public.credits_wallet for select using (auth.uid() = user_id);
create policy if not exists wallet_update_service on public.credits_wallet for update using (false); -- 仅服务端执行

-- credits_ledger: owner can read
create policy if not exists ledger_select_self on public.credits_ledger for select using (auth.uid() = user_id);

-- model_tasks: owner can read/insert; service updates状态
create policy if not exists tasks_select_self on public.model_tasks for select using (auth.uid() = user_id);
create policy if not exists tasks_insert_self on public.model_tasks for insert with check (auth.uid() = user_id);
create policy if not exists tasks_update_service on public.model_tasks for update using (false);

-- model_assets: owner can read via join;公开展示通过帖子访问由后端过滤
create policy if not exists assets_select_self on public.model_assets for select using (
  exists(select 1 from public.model_tasks t where t.id = task_id and t.user_id = auth.uid())
);

-- showcase_posts: 公开读取 published；作者可写；管理员可下架（由后端服务控制）
create policy if not exists posts_select_public on public.showcase_posts for select using (status = 'published');
create policy if not exists posts_insert_author on public.showcase_posts for insert with check (auth.uid() = author_id);
create policy if not exists posts_update_author on public.showcase_posts for update using (auth.uid() = author_id);

-- Notes:
-- 1) 服务端需要使用 service role bypass RLS 进行积分扣减、任务状态更新、管理员下架。
-- 2) 建议在后端使用事务处理：扣积分 + 创建任务 + 失败补偿。

