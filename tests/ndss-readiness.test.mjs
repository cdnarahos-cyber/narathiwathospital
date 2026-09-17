import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');

const index = read('index.html');
assert.ok(index.includes('src/main.js?v=20260917-12'), 'the startup script must use the current cache-busting version');
const localAssets = [...index.matchAll(/(?:href|src)="(\.\/[^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1].replace(/^\.\//, ''));
assert.ok(localAssets.length >= 20, 'startup page must include the expected local assets');
for (const asset of localAssets) assert.ok(existsSync(join(root, asset)), `startup asset is missing: ${asset}`);

const main = read('src/main.js');
assert.ok(main.includes("dashboard-service.js?v=20260916-3"), 'the updated central case deletion service must not be served from a stale cache');
for (const capability of [
  'hydrateInvestigationCases',
  'hydrateOperationalRecords',
  'runPreflight',
  'data-open-506-import',
  'data-supabase-signout',
  'data-run-preflight',
  'คิวแจ้งเหตุการเชื่อมต่อ',
  'ndss-last-preflight-at',
  'การเข้าถึงข้อมูลผู้ป่วย รายงาน และสถานการณ์โรคต้องผ่านการยืนยันตัวตน',
  'app.inert = !allowed',
]) assert.ok(main.includes(capability), `operational capability is missing: ${capability}`);

// Every data-driven button must have a second reference in the application
// source (its delegated handler, renderer, or feature service). This catches
// visual buttons accidentally left without a working action after refactors.
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : entry.name.endsWith('.js') ? [path] : [];
});
const applicationSource = walk(join(root, 'src')).map(file => readFileSync(file, 'utf8')).join('\n');
const buttonActions = new Set([...applicationSource.matchAll(/<button\b[^>]*>/g)]
  .flatMap(button => [...button[0].matchAll(/\b(data-[a-z0-9-]+)(?:=|\s|>)/g)].map(match => match[1])));
const buttonMetadata = new Set(['data-epi-target', 'data-user-id']);
for (const action of buttonActions) {
  if (buttonMetadata.has(action)) continue;
  const references = applicationSource.split(action).length - 1;
  assert.ok(references >= 2, `${action} is rendered as a button but has no linked application action`);
}

const layout = read('src/components/layout.js');
assert.ok(layout.includes('data-current-user-sidebar-name'), 'signed-in user name must be visible in the mobile menu');
assert.ok(layout.includes('data-current-user-detail'), 'signed-in user status must be visible in the header');
assert.ok(main.includes('data-label="รายละเอียดผู้ใช้งาน"'), 'mobile account cards must label registered user details');
assert.ok(main.includes("const mayImport=['admin','officer'].includes(getSupabaseRole())"), 'only ADMIN and OFFICER may see the Excel import control');
assert.ok(main.includes("getSupabaseRole()==='admin'"), 'settings and local backup controls must be limited to ADMIN');
assert.ok(main.includes('กำลังรีเฟรช…'), 'admin refresh must provide a visible loading state');
assert.ok(main.includes("loadAdminUsers({ notify: true })"), 'admin refresh button must explicitly reload the user list');
const commandStyles = read('src/styles/command-reference.css');
assert.ok(commandStyles.includes('[data-admin-user-action="update"]'), 'save-role action must have a dedicated high-visibility style');
assert.ok(commandStyles.includes('[data-admin-user-action="delete"]'), 'delete action must have a dedicated high-visibility style');
const eventReport = read('src/components/command-center.js');
assert.ok(eventReport.includes('data-event-report-page-size'), 'Event report must offer the requested page size selector');
for (const selector of ['data-dashboard-disease-page-size', 'data-506-report-page-size', 'data-event-report-page-size']) {
  const source = selector === 'data-dashboard-disease-page-size' ? main : eventReport;
  const position = source.indexOf(selector);
  assert.ok(position >= 0 && source.slice(position, position + 900).includes('value="15"'), `${selector} must offer 15 items per page`);
}
assert.ok(eventReport.includes('data-event-report-page'), 'Event report page controls must have a linked action');
assert.ok(eventReport.includes('event-report-sheet'), 'Event report must use its dedicated desktop header layout');
const eventReportStyles = read('src/styles/event-report-desktop-fix.css');
assert.ok(eventReportStyles.includes('border-bottom: 0'), 'Event report header separator must be removed to prevent title overlap');
assert.ok(eventReportStyles.includes('.event-report-sheet > .panel-top'), 'Event report must hide its duplicate section title');
assert.ok(eventReportStyles.includes('font-size: 16px'), 'Event report heading must use the compact font size');
assert.ok(main.includes('ndss-event-report-page-size'), 'Event report page size must be persisted and rendered');
assert.ok(main.includes('ndss-event-report-page'), 'Event report pagination must be handled by the application');
assert.ok(main.includes('ndss-alert-page-size'), 'alert list must persist the selected page size');
assert.ok(main.includes('data-alert-page'), 'alert list page controls must have a linked action');
assert.ok(read('src/styles/alert-pagination.css').includes('.alert-pagination'), 'alert pagination layout stylesheet is missing');
assert.ok(main.includes("controls.querySelectorAll('[data-alert-filter]')"), 'alert filter buttons must have direct click handlers');
assert.ok(main.includes('data-alert-search-submit'), 'alert search must include an explicit search button');
assert.ok(read('src/styles/alert-pagination.css').includes('.alert-search-submit'), 'alert search button must have a dedicated visible style');
assert.ok(main.includes("panel.classList.add('alert-list-panel')"), 'alert list must expose a dedicated compact layout hook');
assert.ok(read('src/styles/alert-pagination.css').includes('.alert-list-panel > .panel-top'), 'alert list header must reserve visible space between the title and action');
assert.ok(main.includes('enhancePaginationSelectors'), 'all existing paginated modules must receive the shared 15/25/50/100 selector');
assert.ok(main.includes('enhanceSearchButtons'), 'searchable modules must receive an explicit search button');
assert.ok(main.includes('data-audit-page-size'), 'Audit Log must offer 15, 25, 50, and 100 item page size selector');
assert.ok(main.includes('data-audit-page'), 'Audit Log page controls must be handled by the application');
assert.ok(main.includes('renderAuditLog'), 'Audit Log must re-render when a page is selected');
assert.ok(eventReport.includes('data-audit-pagination'), 'Audit Log must render a pagination region');
assert.ok(read('src/styles/app.css').includes('[data-clear-audit]'), 'Audit Log clear-history action must have a dedicated compact highlight');
assert.ok(read('src/styles/app.css').includes('.audit-list article[hidden]{display:none!important}'), 'hidden Audit Log rows must not remain visible after changing pages');
assert.ok(read('src/styles/module-search-actions.css').includes('.module-search-submit'), 'shared search action style is missing');
assert.ok(main.includes("control.className = 'module-search-control'"), 'search input and submit button must be grouped together');
assert.ok(read('src/styles/module-search-actions.css').includes('.module-search-control'), 'grouped search controls must have a compact layout style');
assert.ok(read('src/styles/mobile-module-compaction.css').includes('.module-search-control'), 'mobile modules must keep search input and action compact');
assert.ok(read('src/styles/mobile-module-compaction.css').includes('.history-table-wrap > table'), 'mobile tables must scroll instead of squeezing content');
assert.ok(read('src/styles/alert-pagination.css').includes('grid-template-columns: 12px minmax(0, 1fr) auto auto'), 'alert actions must remain on one compact desktop row');
assert.ok(read('src/styles/alert-pagination.css').includes('[data-ack-alert]'), 'alert acknowledge action must have a high-visibility style');
assert.ok(read('src/styles/alert-pagination.css').includes('.alert-feed article[hidden]'), 'filtered alert cards must be visually hidden');

const migrationDirectory = join(root, 'supabase', 'migrations');
const migrations = readdirSync(migrationDirectory).filter(file => file.endsWith('.sql')).map(file => read(`supabase/migrations/${file}`)).join('\n');
assert.match(migrations, /app_metadata[^\n]*ndss_role/i, 'central policies must authorize using app_metadata roles');
assert.match(migrations, /surveillance_506_records/i, 'central 506 table policy is missing');
assert.match(migrations, /ndss_audit_events/i, 'central audit trail policy is missing');
const officer506Policy = read('supabase/migrations/20260911090000_allow_officer_506_imports.sql');
assert.match(officer506Policy, /surveillance_506_records/i, 'officer 506 table policy is missing');
assert.match(officer506Policy, /'admin',\s*'officer'/i, 'officer must be allowed to import 506 records');

const runtimeConfig = read('src/config/runtime-config.js');
assert.ok(!/service[_-]?role\s*[:=]\s*['"][^'"]+/i.test(runtimeConfig), 'a service-role key must never be in browser runtime configuration');

const supabaseConfig = read('src/config/supabase.js');
assert.ok(supabaseConfig.includes('getSupabaseDisplayIdentity'), 'signed-in identity display helper is missing');
assert.ok(supabaseConfig.includes('สถานะ: ใช้งานอยู่'), 'signed-in account status is missing');
assert.ok(supabaseConfig.includes('server-issued app_metadata claim'), 'profile metadata must not control authorization');
assert.ok(supabaseConfig.includes('allowSessionRefresh = true'), 'admin requests must retry once with a refreshed session');

const manageUsersFunction = read('supabase/functions/manage-users/index.ts');
assert.ok(manageUsersFunction.includes('fullName: user.user_metadata?.full_name'), 'ADMIN user list must include registered full name');
assert.ok(manageUsersFunction.includes('phone: user.phone || user.user_metadata?.phone'), 'ADMIN user list must include registered phone');
assert.ok(manageUsersFunction.includes('emailConfirmedAt: user.email_confirmed_at'), 'ADMIN user list must include the actual Supabase email confirmation state');
assert.ok(!/password:\s*user\./i.test(manageUsersFunction), 'user passwords must never be returned from the admin API');
assert.ok(main.includes('user.emailConfirmedAt'), 'ADMIN account table must render the server-confirmed email state');

const functionDeployWorkflow = read('.github/workflows/deploy-supabase-functions.yml');
assert.ok(functionDeployWorkflow.includes('supabase functions deploy manage-users'), 'manage-users deployment workflow is missing');
assert.ok(functionDeployWorkflow.includes('SUPABASE_FUNCTIONS_DEPLOY_ENABLED'), 'function deployment must require explicit repository approval');
assert.ok(!/SUPABASE_ACCESS_TOKEN:\s*['"][A-Za-z0-9_\-]+/i.test(functionDeployWorkflow), 'function deployment must not commit an access token');

const acceptanceChecklist = read('supabase/ACCEPTANCE-CHECKLIST.md');
for (const item of ['ADMIN', 'OFFICER', 'VIEWER', 'ข้อมูลระบุตัวบุคคล', 'ไม่มีรายการส่วนกลางซ้ำ', 'Audit Log', 'บันทึกผลการทดสอบรายบัญชี']) {
  assert.ok(acceptanceChecklist.includes(item), `role/data UAT checklist is missing: ${item}`);
}
const productionRunbook = read('supabase/PRODUCTION-RUNBOOK.md');
for (const item of ['current Free Plan has no scheduled project backups', 'Never perform a restore over the production project', 'Do not run bulk upload or artificial load tests against the production project during clinic hours']) {
  assert.ok(productionRunbook.includes(item), `production recovery/load safeguard is missing: ${item}`);
}
const auditService = read('src/services/audit-service.js');
assert.ok(auditService.includes("'ndss-central-failure'"), 'central connection failures must notify the UI');
assert.ok(auditService.includes('ndss-pending-audit-events'), 'central connection failures must be queued for retry');
assert.ok(main.includes("await deleteOperationalRecord('contact', item.remoteId)"), 'synced contacts must delete from the central database before local state');
assert.ok(main.includes("await deleteOperationalRecord('lab', item.remoteId)"), 'synced lab results must delete from the central database before local state');
const dashboardService = read('src/services/dashboard-service.js');
assert.ok(dashboardService.includes('refreshSupabaseSession'), 'case deletion must renew a stale server-issued role claim once');
assert.ok(dashboardService.includes('สิทธิ์ ADMIN ไม่เป็นปัจจุบัน'), 'case deletion must show an actionable authorization error');
assert.ok(dashboardService.includes('รหัสเคสที่เชื่อมโยงกับฐานข้อมูลกลางไม่ถูกต้อง'), 'case deletion must explain an invalid central case identifier');
assert.ok(dashboardService.includes("invokeAdminUserManagement('delete_case'"), 'case deletion must have a server-verified ADMIN fallback for stale RLS claims');
assert.ok(manageUsersFunction.includes('action === "delete_case"'), 'the ADMIN gateway must only accept an explicit delete-case action');
assert.ok(manageUsersFunction.includes('invalid_case'), 'the ADMIN gateway must validate the central case UUID');
assert.ok(manageUsersFunction.includes('action === "update"'), 'the ADMIN save-role control must be handled by the server');
assert.ok(manageUsersFunction.includes('invalid_update'), 'the ADMIN save-role control must validate role and status');
assert.ok(manageUsersFunction.includes('cannot_change_own_access'), 'the ADMIN gateway must prevent self-lockout');

console.log(`ndss readiness tests passed (${localAssets.length} local startup assets and ${buttonActions.size} button actions verified)`);
