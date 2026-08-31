-- NDSS secure core schema.
-- Apply with the Supabase migration `ndss_secure_core`.
-- Use only a publishable key in the browser; never expose a service-role/secret key.
create extension if not exists pgcrypto;
create table if not exists public.disease_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  disease_name text not null,
  patient_summary text not null,
  location_name text not null,
  status text not null check (status in ('pending', 'acknowledged', 'in_progress', 'controlled', 'overdue')),
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);

create index if not exists disease_cases_reported_at_idx on public.disease_cases (reported_at desc);
create index if not exists disease_cases_status_reported_at_idx on public.disease_cases (status, reported_at desc);

create table if not exists public.smart_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);

create index if not exists smart_alerts_created_at_idx on public.smart_alerts (created_at desc);

alter table public.disease_cases enable row level security;
alter table public.smart_alerts enable row level security;

-- Do not expose clinical records to anonymous visitors.
revoke all on public.disease_cases, public.smart_alerts from anon;
revoke all on public.disease_cases, public.smart_alerts from authenticated;
grant select on public.disease_cases, public.smart_alerts to authenticated;
grant insert, update on public.disease_cases, public.smart_alerts to authenticated;

drop policy if exists "authenticated staff can read disease cases" on public.disease_cases;
drop policy if exists "authenticated staff can create disease cases" on public.disease_cases;
drop policy if exists "authenticated staff can update disease cases" on public.disease_cases;
drop policy if exists "authenticated staff can read alerts" on public.smart_alerts;
drop policy if exists "authenticated staff can create alerts" on public.smart_alerts;
drop policy if exists "ndss staff can read cases" on public.disease_cases;
drop policy if exists "ndss staff can create cases" on public.disease_cases;
drop policy if exists "ndss staff can update own cases" on public.disease_cases;
drop policy if exists "ndss staff can read alerts" on public.smart_alerts;
drop policy if exists "ndss staff can create alerts" on public.smart_alerts;
drop policy if exists "ndss staff can update own alerts" on public.smart_alerts;

-- Authorize from app_metadata only. Never use user_metadata for access decisions.
create policy "ndss staff can read cases" on public.disease_cases
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist', 'viewer'));

create policy "ndss staff can create cases" on public.disease_cases
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist')
    and created_by = (select auth.uid())
  );

create policy "ndss staff can update own cases" on public.disease_cases
  for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist')
    and created_by = (select auth.uid())
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist')
    and created_by = (select auth.uid())
  );

create policy "ndss staff can read alerts" on public.smart_alerts
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist', 'viewer'));

create policy "ndss staff can create alerts" on public.smart_alerts
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist')
    and created_by = (select auth.uid())
  );

create policy "ndss staff can update own alerts" on public.smart_alerts
  for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist')
    and created_by = (select auth.uid())
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'epidemiologist')
    and created_by = (select auth.uid())
  );

