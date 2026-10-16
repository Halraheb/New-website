-- قاعدة بيانات موقع "تحصيلي فيزياء 2"
-- شغّل هذا الملف كاملًا مرة واحدة من: Supabase ← SQL Editor ← New query ← Run

-- 1) سجل الزيارات والأحداث (فتح الموقع، بدء اختبار، نهاية مسابقة فرق)
create table if not exists public.visits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  text check (char_length(visitor_id) <= 60),
  event       text not null check (event in ('visit','start','team_finish')),
  name        text check (char_length(name) <= 60),
  mode        text check (char_length(mode) <= 20),
  details     jsonb check (octet_length(details::text) <= 4000),
  page        text check (char_length(page) <= 200),
  referrer    text check (char_length(referrer) <= 300),
  user_agent  text check (char_length(user_agent) <= 300),
  lang        text check (char_length(lang) <= 20),
  screen      text check (char_length(screen) <= 20)
);

-- 2) نتائج الطلاب (كل اختبار فردي مكتمل)
create table if not exists public.attempts (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  client_id   text unique check (char_length(client_id) <= 60),
  visitor_id  text check (char_length(visitor_id) <= 60),
  name        text not null check (char_length(name) between 1 and 60),
  units       text[] not null default '{}' check (cardinality(units) <= 10),
  correct     int not null check (correct between 0 and 200),
  total       int not null check (total between 0 and 200),
  pct         int not null check (pct between 0 and 100),
  by_topic    jsonb check (octet_length(by_topic::text) <= 2000),
  check (correct <= total)
);

create index if not exists visits_created_idx   on public.visits (created_at desc);
create index if not exists attempts_created_idx on public.attempts (created_at desc);

-- 3) المعلمون المسموح لهم بقراءة البيانات (بالبريد الإلكتروني)
create table if not exists public.teachers (
  email text primary key
);

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 4) قواعد الأمان: الزوار يضيفون فقط، والمعلم وحده يقرأ
alter table public.visits   enable row level security;
alter table public.attempts enable row level security;
alter table public.teachers enable row level security;

drop policy if exists "anyone can insert visits"   on public.visits;
drop policy if exists "teachers read visits"       on public.visits;
drop policy if exists "teachers delete visits"     on public.visits;
drop policy if exists "anyone can insert attempts" on public.attempts;
drop policy if exists "teachers read attempts"     on public.attempts;
drop policy if exists "teachers delete attempts"   on public.attempts;

create policy "anyone can insert visits"   on public.visits   for insert to anon, authenticated with check (true);
create policy "teachers read visits"       on public.visits   for select to authenticated using (public.is_teacher());
create policy "teachers delete visits"     on public.visits   for delete to authenticated using (public.is_teacher());
create policy "anyone can insert attempts" on public.attempts for insert to anon, authenticated with check (true);
create policy "teachers read attempts"     on public.attempts for select to authenticated using (public.is_teacher());
create policy "teachers delete attempts"   on public.attempts for delete to authenticated using (public.is_teacher());

-- 5) أضف بريدك (نفس البريد الذي ستنشئ به حساب المعلم في Authentication ← Users)
-- insert into public.teachers (email) values ('your-email@example.com');
