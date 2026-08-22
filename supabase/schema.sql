-- NDSS core schema. Run in the Supabase SQL Editor as a project administrator.
create table if not exists public.disease_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  disease_name text not null,
  patient_summary text not null,
  location_name text not null,
  status text not null check (status in ('pending', 'acknowledged', 'in_progress', 'controlled', 'overdue')),
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) not null default auth.uid()
);

create index if not exists disease_cases_reported_at_idx on public.disease_cases (reported_at desc);
create index if not exists disease_cases_status_reported_at_idx on public.disease_cases (status, reported_at desc);

create table if not exists public.smart_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) not null default auth.uid()
);

create index if not exists smart_alerts_created_at_idx on public.smart_alerts (created_at desc);

alter table public.disease_cases enable row level security;
alter table public.smart_alerts enable row level security;

-- Replace this broad staff policy with a role/department predicate before production rollout.
create policy "authenticated staff can read disease cases" on public.disease_cases for select to authenticated using (true);
create policy "authenticated staff can create disease cases" on public.disease_cases for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "authenticated staff can update disease cases" on public.disease_cases for update to authenticated using (true) with check ((select auth.uid()) = created_by);
create policy "authenticated staff can read alerts" on public.smart_alerts for select to authenticated using (true);
create policy "authenticated staff can create alerts" on public.smart_alerts for insert to authenticated with check ((select auth.uid()) = created_by);
