import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');

const index = read('index.html');
const localAssets = [...index.matchAll(/(?:href|src)="(\.\/[^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1].replace(/^\.\//, ''));
assert.ok(localAssets.length >= 20, 'startup page must include the expected local assets');
for (const asset of localAssets) assert.ok(existsSync(join(root, asset)), `startup asset is missing: ${asset}`);

const main = read('src/main.js');
for (const capability of [
  'hydrateInvestigationCases',
  'hydrateOperationalRecords',
  'runPreflight',
  'data-open-506-import',
  'data-supabase-signout',
  'data-run-preflight',
  'การเข้าถึงข้อมูลผู้ป่วย รายงาน และสถานการณ์โรคต้องผ่านการยืนยันตัวตน',
  'app.inert = !allowed',
]) assert.ok(main.includes(capability), `operational capability is missing: ${capability}`);

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

console.log(`ndss readiness tests passed (${localAssets.length} local startup assets verified)`);
