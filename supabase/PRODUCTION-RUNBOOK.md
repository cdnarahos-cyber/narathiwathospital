# NDSS production runbook

Use this checklist before and during production operation. Do not place service-role keys, passwords, patient exports, or access tokens in this repository.

## 1. Supabase Auth hardening

1. Sign in to the Supabase Dashboard for project `cdnarahos-cyber`.
2. Open **Authentication** → **Configuration** → **Password Security**.
3. Keep **Secure password change** and **Require current password when updating** enabled. These were enabled on 2026-09-10.
4. Turn on **Leaked Password Protection** when the project is upgraded to Pro or above, then re-run **Database** → **Advisors** → **Security**.

This setting is managed by Supabase Auth and cannot be changed safely from browser-side NDSS code.

## 2. Backup and recovery verification

1. The current Free Plan has no scheduled project backups. Until a paid backup plan is approved, retain every original Excel file in approved hospital storage and have ADMIN export the operational report at least daily and before any bulk update.
2. Store exported files outside the browser device, name them with the date/time and operator, and restrict the folder to authorised hospital staff.
3. A CSV/PDF export is an operational fallback only; it is **not** a database backup and cannot validate a full database restore.
4. Before storing production patient data solely in Supabase, upgrade to Pro or above and check the Backup/Database settings in the Supabase Dashboard.
5. Confirm the latest automatic backup timestamp and retention period meet the hospital policy. At least once per quarter, restore a backup into a separate development branch or temporary project.
6. In that isolated copy, verify table counts for `disease_cases`, `smart_alerts`, `lab_results`, `case_contacts`, and `response_tasks`. Record the test date, operator, backup timestamp, result, and any corrective action in the hospital IT change record.

Never perform a restore over the production project merely to test recovery.

## 3. Role acceptance test

Use separate browser profiles or private windows. Do not share passwords.

| Role | Expected result |
| --- | --- |
| ADMIN | May manage accounts, assign and update any case, manage alerts, and delete only where the UI explicitly allows it. |
| OFFICER | May import รง.506, create a case assigned to themselves, and update only cases created by or assigned to them; cannot manage users or delete central cases. |
| VIEWER | May view permitted dashboards and reports; may not create, modify, import, or delete operational data. |

After a role is changed by ADMIN, the user must sign out and sign in again (or refresh their session) so the new `app_metadata.ndss_role` claim is applied.

## 4. Routine operating checks

- Before each import, retain the original Excel file in the approved hospital storage location.
- Verify the import quality summary: disease, onset date, and area fields.
- During import, wait for the blue progress indicator to complete. A green result means central sync completed; a red “รอซิงค์ฐานข้อมูลกลาง” message means the local import succeeded but must be retried after connectivity is restored.
- When several officers receive the same source file, they may import it safely: the system uses a stable source key and database upsert to avoid creating duplicate central rows.
- Test one generated PDF after a browser update or a deployment.
- Review Supabase Security Advisors monthly and Performance Advisors quarterly.
- Use the hospital incident process for suspected account misuse or unintended patient-data access.

## 5. Load-monitoring baseline

1. In Supabase **Observability**, review API response errors, response speed, database connections, CPU, and disk usage at least weekly during the first month of operation.
2. Escalate to hospital IT when API errors exceed 1% for 15 minutes, database connections stay near the plan limit, or CPU/disk IOPS remain saturated for 15 minutes.
3. Do not run bulk upload or artificial load tests against the production project during clinic hours. Use a separate Supabase project and non-patient test files for stress testing.
4. Retain the date, time range, observed metrics, and response action in the hospital IT change record.
