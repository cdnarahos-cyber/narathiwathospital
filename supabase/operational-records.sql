-- NDSS operational records: laboratory, contacts, and follow-up tasks.
-- Run this once in the Supabase SQL Editor after supabase/schema.sql.
-- Authorization uses app_metadata.ndss_role only; never use user_metadata.
-- If the project's Data API does not automatically expose new tables, also add
-- lab_results, case_contacts, and response_tasks in Dashboard > API > Exposed schemas.

create extension if not exists pgcrypto;

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  case_number text,
  specimen_no text not null,
  test_name text not null,
  received_on date,
  result text not null check (result in ('รอตรวจสอบ', 'Positive', 'Negative', 'ไม่สามารถทดสอบได้')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);

create table if not exists public.case_contacts (
  id uuid primary key default gen_random_uuid(),
  case_number text,
  contact_name text not null,
  relationship text,
  phone text,
  symptom text,
  followup text not null default 'รอติดตาม',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);

create table if not exists public.response_tasks (
  id uuid primary key default gen_random_uuid(),
  case_number text,
  owner_name text not null,
  due_date date,
  priority text,
  status text not null default 'รอรับทราบ',
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict
);

create index if not exists lab_results_created_at_idx on public.lab_results (created_at desc);
create index if not exists case_contacts_created_at_idx on public.case_contacts (created_at desc);
create index if not exists response_tasks_due_date_idx on public.response_tasks (due_date);

alter table public.lab_results enable row level security;
alter table public.case_contacts enable row level security;
alter table public.response_tasks enable row level security;

revoke all on public.lab_results, public.case_contacts, public.response_tasks from anon;
revoke all on public.lab_results, public.case_contacts, public.response_tasks from authenticated;
grant select, insert, update, delete on public.lab_results, public.case_contacts, public.response_tasks to authenticated;

drop policy if exists "ndss read lab results" on public.lab_results;
drop policy if exists "ndss create lab results" on public.lab_results;
drop policy if exists "ndss update own lab results" on public.lab_results;
drop policy if exists "ndss delete own lab results" on public.lab_results;
drop policy if exists "ndss read case contacts" on public.case_contacts;
drop policy if exists "ndss create case contacts" on public.case_contacts;
drop policy if exists "ndss update own case contacts" on public.case_contacts;
drop policy if exists "ndss delete own case contacts" on public.case_contacts;
drop policy if exists "ndss read response tasks" on public.response_tasks;
drop policy if exists "ndss create response tasks" on public.response_tasks;
drop policy if exists "ndss update own response tasks" on public.response_tasks;
drop policy if exists "ndss delete own response tasks" on public.response_tasks;

create policy "ndss read lab results" on public.lab_results for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer', 'viewer'));
create policy "ndss create lab results" on public.lab_results for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer') and created_by = (select auth.uid()));
create policy "ndss update own lab results" on public.lab_results for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())))
  with check ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
create policy "ndss delete own lab results" on public.lab_results for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));

create policy "ndss read case contacts" on public.case_contacts for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer', 'viewer'));
create policy "ndss create case contacts" on public.case_contacts for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer') and created_by = (select auth.uid()));
create policy "ndss update own case contacts" on public.case_contacts for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())))
  with check ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
create policy "ndss delete own case contacts" on public.case_contacts for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));

create policy "ndss read response tasks" on public.response_tasks for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer', 'viewer'));
create policy "ndss create response tasks" on public.response_tasks for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer') and created_by = (select auth.uid()));
create policy "ndss update own response tasks" on public.response_tasks for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())))
  with check ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
create policy "ndss delete own response tasks" on public.response_tasks for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' or ((auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
