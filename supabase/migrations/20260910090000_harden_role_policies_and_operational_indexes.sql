-- Production hardening migration applied to Supabase on 2026-09-10.
-- Keeps authorization in app_metadata.ndss_role and evaluates auth helpers once.

drop policy if exists "ndss staff can read cases" on public.disease_cases;
drop policy if exists "ndss staff can create cases" on public.disease_cases;
drop policy if exists "ndss staff can update own cases" on public.disease_cases;
drop policy if exists "ndss cases select by role" on public.disease_cases;
drop policy if exists "ndss officers create cases" on public.disease_cases;
drop policy if exists "ndss cases update by assignment" on public.disease_cases;
drop policy if exists "ndss admins delete cases" on public.disease_cases;

create policy "ndss cases select by role" on public.disease_cases for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','viewer')
  or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer'
      and (created_by = (select auth.uid()) or assigned_to = (select auth.uid()))));
create policy "ndss cases create by role" on public.disease_cases for insert to authenticated
with check (created_by = (select auth.uid()) and (
  ((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or
  (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and assigned_to = (select auth.uid()))));
create policy "ndss cases update by assignment" on public.disease_cases for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or
  (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and assigned_to = (select auth.uid())))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or
  (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and assigned_to = (select auth.uid())));
create policy "ndss admins delete cases" on public.disease_cases for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin');

drop policy if exists "ndss staff can read alerts" on public.smart_alerts;
drop policy if exists "ndss staff can create alerts" on public.smart_alerts;
drop policy if exists "ndss staff can update own alerts" on public.smart_alerts;
drop policy if exists "ndss alerts select by role" on public.smart_alerts;
drop policy if exists "ndss admins create alerts" on public.smart_alerts;
drop policy if exists "ndss admins update alerts" on public.smart_alerts;
drop policy if exists "ndss admins delete alerts" on public.smart_alerts;

create policy "ndss alerts select by role" on public.smart_alerts for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer','viewer'));
create policy "ndss alerts create by role" on public.smart_alerts for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer') and created_by = (select auth.uid()));
create policy "ndss alerts update by role" on public.smart_alerts for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or
  (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or
  (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
create policy "ndss admins delete alerts" on public.smart_alerts for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin');

create index if not exists case_contacts_created_by_idx on public.case_contacts(created_by);
create index if not exists lab_results_created_by_idx on public.lab_results(created_by);
create index if not exists response_tasks_created_by_idx on public.response_tasks(created_by);

-- Existing operational policies keep their behavior; use SELECT-wrapped auth calls
-- so their JWT and UID expressions are evaluated once per query.
alter policy "lab read" on public.lab_results using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer','viewer'));
alter policy "lab insert" on public.lab_results with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer') and created_by = (select auth.uid()));
alter policy "lab update" on public.lab_results using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid()))) with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
alter policy "lab delete" on public.lab_results using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));

alter policy "contacts read" on public.case_contacts using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer','viewer'));
alter policy "contacts insert" on public.case_contacts with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer') and created_by = (select auth.uid()));
alter policy "contacts update" on public.case_contacts using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid()))) with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
alter policy "contacts delete" on public.case_contacts using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));

alter policy "tasks read" on public.response_tasks using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer','viewer'));
alter policy "tasks insert" on public.response_tasks with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin','officer') and created_by = (select auth.uid()));
alter policy "tasks update" on public.response_tasks using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid()))) with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
alter policy "tasks delete" on public.response_tasks using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' or (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'officer' and created_by = (select auth.uid())));
