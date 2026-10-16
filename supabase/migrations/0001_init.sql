-- 捕梦 2.0 初始化迁移
--
-- 在 Supabase SQL Editor 中执行本文件，或在本地执行：
--   supabase db push
--
-- 安全模型：
--   1. 所有用户数据表都开启 Row Level Security（RLS）；
--   2. 每条策略都要求 auth.uid() = user_id，因此即使用户伪造请求参数，
--      也只能读写属于自己的行；
--   3. 子表（writing_versions / literary_echoes / ai_feedback）额外校验
--      其所属的父记录也属于当前用户，避免「借用别人的 writing_id 写入」。

-- ---------------------------------------------------------------------------
-- 通用：updated_at 自动维护
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '用户资料，id 与 auth.users.id 一致';

-- 新用户注册时自动建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inspirations：灵感
-- ---------------------------------------------------------------------------
create table if not exists public.inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspirations_content_length check (char_length(content) <= 40000),
  constraint inspirations_title_length check (char_length(title) <= 200),
  constraint inspirations_tags_count check (cardinality(tags) <= 12)
);

create index if not exists inspirations_user_updated_idx
  on public.inspirations (user_id, updated_at desc);
create index if not exists inspirations_tags_idx
  on public.inspirations using gin (tags);

drop trigger if exists inspirations_set_updated_at on public.inspirations;
create trigger inspirations_set_updated_at
  before update on public.inspirations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- writings：作品
-- ---------------------------------------------------------------------------
create table if not exists public.writings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  source_inspiration_id uuid references public.inspirations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint writings_content_length check (char_length(content) <= 200000),
  constraint writings_title_length check (char_length(title) <= 200),
  constraint writings_tags_count check (cardinality(tags) <= 12)
);

create index if not exists writings_user_updated_idx
  on public.writings (user_id, updated_at desc);
create index if not exists writings_tags_idx
  on public.writings using gin (tags);

drop trigger if exists writings_set_updated_at on public.writings;
create trigger writings_set_updated_at
  before update on public.writings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- writing_versions：作品版本历史
-- ---------------------------------------------------------------------------
create table if not exists public.writing_versions (
  id uuid primary key default gen_random_uuid(),
  writing_id uuid not null references public.writings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists writing_versions_writing_created_idx
  on public.writing_versions (writing_id, created_at desc);
create index if not exists writing_versions_user_idx
  on public.writing_versions (user_id);

-- ---------------------------------------------------------------------------
-- literary_echoes：文学回声记录
-- ---------------------------------------------------------------------------
create table if not exists public.literary_echoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  inspiration_id uuid references public.inspirations (id) on delete set null,
  query_text text not null,
  -- 如实记录这次结果是真实模型生成的，还是本地目录匹配的
  generated_by text not null default 'local-catalog'
    check (generated_by in ('deepseek', 'local-catalog')),
  results_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint literary_echoes_query_length check (char_length(query_text) <= 40000)
);

create index if not exists literary_echoes_user_created_idx
  on public.literary_echoes (user_id, created_at desc);
create index if not exists literary_echoes_inspiration_idx
  on public.literary_echoes (inspiration_id);

-- ---------------------------------------------------------------------------
-- ai_feedback：AI 分析记录
-- ---------------------------------------------------------------------------
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  writing_id uuid references public.writings (id) on delete set null,
  mode text not null check (mode in ('feedback', 'polish', 'structure', 'voice', 'next')),
  feedback jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_user_created_idx
  on public.ai_feedback (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- preferences：AI 偏好
-- ---------------------------------------------------------------------------
create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  polish_level text not null default 'light' check (polish_level in ('light', 'medium')),
  feedback_length text not null default 'standard'
    check (feedback_length in ('short', 'standard', 'long')),
  auto_save_inspiration boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.inspirations enable row level security;
alter table public.writings enable row level security;
alter table public.writing_versions enable row level security;
alter table public.literary_echoes enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.preferences enable row level security;

-- profiles：只允许本人读写 ------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- inspirations -----------------------------------------------------------
drop policy if exists inspirations_select_own on public.inspirations;
create policy inspirations_select_own on public.inspirations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists inspirations_insert_own on public.inspirations;
create policy inspirations_insert_own on public.inspirations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists inspirations_update_own on public.inspirations;
create policy inspirations_update_own on public.inspirations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists inspirations_delete_own on public.inspirations;
create policy inspirations_delete_own on public.inspirations
  for delete to authenticated using (auth.uid() = user_id);

-- writings ---------------------------------------------------------------
drop policy if exists writings_select_own on public.writings;
create policy writings_select_own on public.writings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists writings_insert_own on public.writings;
create policy writings_insert_own on public.writings
  for insert to authenticated with check (
    auth.uid() = user_id
    and (
      source_inspiration_id is null
      or exists (
        select 1 from public.inspirations i
        where i.id = source_inspiration_id and i.user_id = auth.uid()
      )
    )
  );

drop policy if exists writings_update_own on public.writings;
create policy writings_update_own on public.writings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists writings_delete_own on public.writings;
create policy writings_delete_own on public.writings
  for delete to authenticated using (auth.uid() = user_id);

-- writing_versions：必须同时属于本人 + 父作品也属于本人 -------------------
drop policy if exists writing_versions_select_own on public.writing_versions;
create policy writing_versions_select_own on public.writing_versions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists writing_versions_insert_own on public.writing_versions;
create policy writing_versions_insert_own on public.writing_versions
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.writings w
      where w.id = writing_id and w.user_id = auth.uid()
    )
  );

drop policy if exists writing_versions_delete_own on public.writing_versions;
create policy writing_versions_delete_own on public.writing_versions
  for delete to authenticated using (auth.uid() = user_id);

-- literary_echoes --------------------------------------------------------
drop policy if exists literary_echoes_select_own on public.literary_echoes;
create policy literary_echoes_select_own on public.literary_echoes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists literary_echoes_insert_own on public.literary_echoes;
create policy literary_echoes_insert_own on public.literary_echoes
  for insert to authenticated with check (
    auth.uid() = user_id
    and (
      inspiration_id is null
      or exists (
        select 1 from public.inspirations i
        where i.id = inspiration_id and i.user_id = auth.uid()
      )
    )
  );

drop policy if exists literary_echoes_delete_own on public.literary_echoes;
create policy literary_echoes_delete_own on public.literary_echoes
  for delete to authenticated using (auth.uid() = user_id);

-- ai_feedback ------------------------------------------------------------
drop policy if exists ai_feedback_select_own on public.ai_feedback;
create policy ai_feedback_select_own on public.ai_feedback
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists ai_feedback_insert_own on public.ai_feedback;
create policy ai_feedback_insert_own on public.ai_feedback
  for insert to authenticated with check (
    auth.uid() = user_id
    and (
      writing_id is null
      or exists (
        select 1 from public.writings w
        where w.id = writing_id and w.user_id = auth.uid()
      )
    )
  );

drop policy if exists ai_feedback_delete_own on public.ai_feedback;
create policy ai_feedback_delete_own on public.ai_feedback
  for delete to authenticated using (auth.uid() = user_id);

-- preferences ------------------------------------------------------------
drop policy if exists preferences_select_own on public.preferences;
create policy preferences_select_own on public.preferences
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists preferences_insert_own on public.preferences;
create policy preferences_insert_own on public.preferences
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists preferences_update_own on public.preferences;
create policy preferences_update_own on public.preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 权限：匿名角色不获得任何行级访问；登录用户按策略访问
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke all on public.inspirations from anon;
revoke all on public.writings from anon;
revoke all on public.writing_versions from anon;
revoke all on public.literary_echoes from anon;
revoke all on public.ai_feedback from anon;
revoke all on public.preferences from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.inspirations to authenticated;
grant select, insert, update, delete on public.writings to authenticated;
grant select, insert, delete on public.writing_versions to authenticated;
grant select, insert, delete on public.literary_echoes to authenticated;
grant select, insert, delete on public.ai_feedback to authenticated;
grant select, insert, update on public.preferences to authenticated;
