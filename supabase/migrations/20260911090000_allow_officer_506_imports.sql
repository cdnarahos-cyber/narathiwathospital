-- OFFICER may add new surveillance records that they import themselves.
-- Existing records remain immutable to OFFICER; only ADMIN can update or delete them.
drop policy if exists "ndss create 506 records" on public.surveillance_506_records;

create policy "ndss create 506 records"
on public.surveillance_506_records
for insert
to authenticated
with check (
  ((select auth.jwt()) -> 'app_metadata' ->> 'ndss_role') in ('admin', 'officer')
  and imported_by = (select auth.uid())
);
