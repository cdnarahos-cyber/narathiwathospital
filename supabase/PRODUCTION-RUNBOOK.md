# NDSS production runbook

Use this checklist before and during production operation. Do not place service-role keys, passwords, patient exports, or access tokens in this repository.

## 1. Supabase Auth hardening

1. Sign in to the Supabase Dashboard for project `cdnarahos-cyber`.
2. Open **Authentication** → **Configuration** → **Password Security**.
3. Keep **Secure password change** and **Require current password when updating** enabled. These were enabled on 2026-09-10.
4. Turn on **Leaked Password Protection** when the project is upgraded to Pro or above, then re-run **Database** → **Advisors** → **Security**.

This setting is managed by Supabase Auth and cannot be changed safely from browser-side NDSS code.

## 2. Backup and recovery verification

1. The current Free Plan has no scheduled project backups. Upgrade to Pro or above before storing production patient data solely in Supabase.
2. After upgrading, check the project plan and the Backup/Database settings in the Supabase Dashboard.
2. Confirm the latest automatic backup timestamp and retention period meet the hospital policy.
3. At least once per quarter, restore a backup into a separate development branch or temporary project.
4. In that isolated copy, verify table counts for `disease_cases`, `smart_alerts`, `lab_results`, `case_contacts`, and `response_tasks`.
5. Record the test date, operator, backup timestamp, result, and any corrective action in the hospital IT change record.

Never perform a restore over the production project merely to test recovery.

## 3. Role acceptance test

Use separate browser profiles or private windows. Do not share passwords.

| Role | Expected result |
| --- | --- |
| ADMIN | May manage accounts, assign and update any case, manage alerts, and delete only where the UI explicitly allows it. |
| OFFICER | May create a case assigned to themselves; sees and updates only cases created by or assigned to them; cannot import รง.506 or manage users. |
| VIEWER | May view permitted dashboards and reports; may not create, modify, import, or delete operational data. |

After a role is changed by ADMIN, the user must sign out and sign in again (or refresh their session) so the new `app_metadata.ndss_role` claim is applied.

## 4. Routine operating checks

- Before each import, retain the original Excel file in the approved hospital storage location.
- Verify the import quality summary: disease, onset date, and area fields.
- Test one generated PDF after a browser update or a deployment.
- Review Supabase Security Advisors monthly and Performance Advisors quarterly.
- Use the hospital incident process for suspected account misuse or unintended patient-data access.
