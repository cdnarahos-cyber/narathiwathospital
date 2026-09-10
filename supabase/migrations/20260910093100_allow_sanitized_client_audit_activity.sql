drop policy if exists "ndss staff report connection failures" on public.ndss_audit_events;
create policy "ndss staff report connection failures" on public.ndss_audit_events for insert to authenticated
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer')
    and actor_id = (select auth.uid())
    and (
      (action = 'connection_failure' and entity_type = 'client_sync')
      or (action = 'client_activity' and entity_type = 'client_ui')
    )
  );
