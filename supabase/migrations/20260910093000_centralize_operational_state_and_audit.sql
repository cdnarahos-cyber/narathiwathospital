-- Central clinical state, 506 import records, and a minimal audit trail.
-- Authorization deliberately uses app_metadata.ndss_role only.

alter table public.disease_cases add column if not exists record_payload jsonb not null default '{}'::jsonb;
alter table public.lab_results add column if not exists record_payload jsonb not null default '{}'::jsonb;
alter table public.case_contacts add column if not exists record_payload jsonb not null default '{}'::jsonb;
alter table public.response_tasks add column if not exists record_payload jsonb not null default '{}'::jsonb;

create table if not exists public.surveillance_506_records (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  disease_name text,
  onset_date date,
  location_name text,
  raw_record jsonb not null,
  imported_at timestamptz not null default now(),
  imported_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index if not exists surveillance_506_records_onset_date_idx on public.surveillance_506_records (onset_date desc);
create index if not exists surveillance_506_records_disease_name_idx on public.surveillance_506_records (disease_name);

alter table public.surveillance_506_records enable row level security;
revoke all on public.surveillance_506_records from anon;
revoke all on public.surveillance_506_records from authenticated;
grant select on public.surveillance_506_records to authenticated;
grant insert, update, delete on public.surveillance_506_records to authenticated;

drop policy if exists "ndss read 506 records" on public.surveillance_506_records;
drop policy if exists "ndss manage 506 records" on public.surveillance_506_records;
create policy "ndss read 506 records" on public.surveillance_506_records for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer'));
create policy "ndss manage 506 records" on public.surveillance_506_records for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin' and imported_by = (select auth.uid()));

create table if not exists public.ndss_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  details jsonb not null default '{}'::jsonb
);

create index if not exists ndss_audit_events_occurred_at_idx on public.ndss_audit_events (occurred_at desc);
create index if not exists ndss_audit_events_actor_occurred_at_idx on public.ndss_audit_events (actor_id, occurred_at desc);
alter table public.ndss_audit_events enable row level security;
revoke all on public.ndss_audit_events from anon;
revoke all on public.ndss_audit_events from authenticated;
grant select on public.ndss_audit_events to authenticated;
grant insert on public.ndss_audit_events to authenticated;

drop policy if exists "ndss admins read audit events" on public.ndss_audit_events;
drop policy if exists "ndss staff report connection failures" on public.ndss_audit_events;
create policy "ndss admins read audit events" on public.ndss_audit_events for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'ndss_role') = 'admin');
create policy "ndss staff report connection failures" on public.ndss_audit_events for insert to authenticated
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer')
    and actor_id = (select auth.uid())
    and (
      (action = 'connection_failure' and entity_type = 'client_sync')
      or (action = 'client_activity' and entity_type = 'client_ui')
    )
  );

create or replace function public.ndss_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
begin
  row_data := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  insert into public.ndss_audit_events (actor_id, action, entity_type, entity_id, severity, details)
  values (
    auth.uid(), lower(tg_op), tg_table_name, row_data ->> 'id', 'info',
    jsonb_strip_nulls(jsonb_build_object(
      'case_number', row_data ->> 'case_number',
      'status', row_data ->> 'status',
      'result', row_data ->> 'result'
    ))
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.ndss_audit_row_change() from public;

drop trigger if exists ndss_audit_disease_cases on public.disease_cases;
create trigger ndss_audit_disease_cases after insert or update or delete on public.disease_cases
for each row execute function public.ndss_audit_row_change();
drop trigger if exists ndss_audit_lab_results on public.lab_results;
create trigger ndss_audit_lab_results after insert or update or delete on public.lab_results
for each row execute function public.ndss_audit_row_change();
drop trigger if exists ndss_audit_case_contacts on public.case_contacts;
create trigger ndss_audit_case_contacts after insert or update or delete on public.case_contacts
for each row execute function public.ndss_audit_row_change();
drop trigger if exists ndss_audit_response_tasks on public.response_tasks;
create trigger ndss_audit_response_tasks after insert or update or delete on public.response_tasks
for each row execute function public.ndss_audit_row_change();
drop trigger if exists ndss_audit_506_records on public.surveillance_506_records;
create trigger ndss_audit_506_records after insert or update or delete on public.surveillance_506_records
for each row execute function public.ndss_audit_row_change();
