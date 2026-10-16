-- RLS 隔离验证脚本
--
-- 用途：在 Supabase SQL Editor 中执行，验证「用户 A 无法读取或修改用户 B 的数据」。
--
-- 说明（务必知悉）：
--   · 本脚本由捕梦项目提供，但项目开发环境中没有可用的 Supabase 实例，
--     因此它**未经实际执行验证**。请在你自己项目的 SQL Editor 里跑一次。
--   · 整个脚本运行在一个事务里，最后 ROLLBACK，不会留下测试数据。
--   · 依赖 SQL Editor 以 postgres 角色运行（可写 auth.users 用于造测试用户）。
--     若你的环境不允许写 auth.users，请改为在 Auth 面板手动创建两个测试账号，
--     再把下面的 :user_a / :user_b 换成真实的 uuid。
--
-- 期望结果：全部断言通过，最后输出 "RLS isolation test passed"。

begin;

-- 1. 造两个测试用户
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.com', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.com', '', now(), now(), now())
on conflict (id) do nothing;

-- 2. 以用户 A 的身份写入一条灵感
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.inspirations (user_id, title, content)
values ('11111111-1111-4111-8111-111111111111', 'A 的灵感', '只有 A 能看到');

do $$
declare
  visible integer;
begin
  select count(*) into visible from public.inspirations;
  if visible <> 1 then
    raise exception 'A 应当只能看到自己的 1 条灵感，实际看到 % 条', visible;
  end if;
end;
$$;

-- 3. 切到用户 B，应当看不到 A 的数据
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
declare
  visible integer;
begin
  select count(*) into visible from public.inspirations;
  if visible <> 0 then
    raise exception 'B 不应看到任何灵感，实际看到 % 条', visible;
  end if;
end;
$$;

-- 4. B 尝试修改 A 的行：应当影响 0 行
do $$
declare
  affected integer;
begin
  update public.inspirations
     set content = 'B 改的'
   where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'B 不应该能修改 A 的数据，实际修改了 % 行', affected;
  end if;
end;
$$;

-- 5. B 尝试以 A 的身份插入：应当被 with check 拒绝
do $$
begin
  begin
    insert into public.inspirations (user_id, title, content)
    values ('11111111-1111-4111-8111-111111111111', '越权写入', '不应成功');
    raise exception 'B 不应该能替 A 插入数据，但插入成功了';
  exception
    when insufficient_privilege then
      null; -- 预期：RLS 拒绝
  end;
end;
$$;

-- 6. B 尝试把版本写进 A 的作品：应当被父记录校验拒绝
set local role postgres;
insert into public.writings (id, user_id, title, content)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'A 的作品', '正文');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
begin
  begin
    insert into public.writing_versions (writing_id, user_id, title, content)
    values ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', '越权版本', '不应成功');
    raise exception 'B 不应该能给 A 的作品写版本，但写入成功了';
  exception
    when insufficient_privilege then
      null; -- 预期：RLS 拒绝
  end;
end;
$$;

-- 7. 匿名角色应当完全没有访问权限
set local role anon;

do $$
declare
  blocked boolean := false;
begin
  begin
    perform count(*) from public.inspirations;
  exception
    when insufficient_privilege then
      blocked := true;
  end;
  if not blocked then
    raise exception 'anon 角色不应该能查询 inspirations';
  end if;
end;
$$;

raise notice 'RLS isolation test passed';

rollback;
