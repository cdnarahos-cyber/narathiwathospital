-- Keep the trigger-only audit function out of the public RPC surface.
revoke execute on function public.ndss_audit_row_change() from anon, authenticated, public;

create index if not exists surveillance_506_records_imported_by_idx on public.surveillance_506_records (imported_by);

drop policy if exists "ndss read 506 records" on public.surveillance_506_records;
drop policy if exists "ndss manage 506 records" on public.surveillance_506_records;
create policy "ndss read 506 records" on public.surveillance_506_records for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer'));
create policy "ndss create 506 records" on public.surveillance_506_records for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' and imported_by = (select auth.uid()));
create policy "ndss update 506 records" on public.surveillance_506_records for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin' and imported_by = (select auth.uid()));
create policy "ndss delete 506 records" on public.surveillance_506_records for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin');

drop policy if exists "ndss admins read audit events" on public.ndss_audit_events;
drop policy if exists "ndss staff report connection failures" on public.ndss_audit_events;
create policy "ndss admins read audit events" on public.ndss_audit_events for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') = 'admin');
create policy "ndss staff report connection failures" on public.ndss_audit_events for insert to authenticated
  with check (
    ((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer')
    and actor_id = (select auth.uid())
    and (
      (action = 'connection_failure' and entity_type = 'client_sync')
      or (action = 'client_activity' and entity_type = 'client_ui')
    )
  );
