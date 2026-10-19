// Migration tests on a real Postgres engine (PGlite runs in-process; no database server needed).
// Loads the old single-file app's schema with old-style data, then runs both migrations twice.
//   npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const OLD = readFileSync(here('./fixtures/old-app-schema.sql'), 'utf8');
const M1 = readFileSync(here('../../supabase/migrations/20261019000100_phase1_core.sql'), 'utf8');
const M2 = readFileSync(here('../../supabase/migrations/20261019000200_remove_old_pin_rpc.sql'), 'utf8');

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
const db = new PGlite({ extensions: { pgcrypto } });
const q = async (sql, params) => (await db.query(sql, params)).rows;

// Supabase-like setup: API roles + "extensions" schema
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema extensions;
  grant usage on schema public to anon, authenticated, service_role;
`);

// 1. Old app (exactly the schema.sql the old index.html uses) + old-style data
await db.exec(OLD);
await db.exec(`insert into public.app_secret (id, pin_hash) values (1, extensions.crypt('111111', extensions.gen_salt('bf')));`);
await db.exec(`
  insert into public.transactions (type, amount, category, note, txn_date) values
    ('expense', 120.50, 'Food', 'Chai', '2026-10-01'),
    ('expense', 60, 'Travel', null, '2026-10-02'),
    ('expense', 45, 'Food', '   ', '2026-10-03'),
    ('income', 125000, 'Salary', 'October salary', '2026-10-01'),
    ('expense', 999.99, 'Pets', 'Dog food', '2026-09-15');
`);
const before = await q(`select id, type, amount::text as amount, txn_date::text as d, created_at from public.transactions order by id`);

// 2. Phase 1 migration, twice
await db.exec(M1);
await db.exec(M1);
check('phase 1 migration runs twice without error', true);

const after = await q(`select t.id, t.type, t.amount::text as amount, t.txn_date::text as d, t.created_at, t.note, t.category,
  c.name as cat_name, c.type as cat_type, w.name as wallet, t.payment_mode, t.tags, t.deleted_at
  from public.transactions t join public.categories c on c.id = t.category_id join public.wallets w on w.id = t.wallet_id order by t.id`);
check('all existing entries kept', after.length === before.length, `${before.length} -> ${after.length}`);
check('ids, types, amounts, dates, created_at unchanged',
  before.every((b, i) => b.id === after[i].id && b.type === after[i].type && b.amount === after[i].amount && b.d === after[i].d && +b.created_at === +after[i].created_at));
check('categories linked by name and type', after.every((r) => r.cat_name === r.category && r.cat_type === r.type));
check('unknown old category "Pets" became a real category', after.some((r) => r.cat_name === 'Pets'));
check('empty notes filled with the category name', after.filter((r) => r.d === '2026-10-02')[0].note === 'Travel' && after.filter((r) => r.d === '2026-10-03')[0].note === 'Food');
check('real notes untouched', after.some((r) => r.note === 'Chai') && after.some((r) => r.note === 'October salary'));
check('defaults: wallet Cash, payment Cash, no tags, not deleted', after.every((r) => r.wallet === 'Cash' && r.payment_mode === 'Cash' && r.tags.length === 0 && r.deleted_at === null));
const cats = await q(`select type, count(*)::int n from public.categories group by type order by type`);
check('default categories seeded once (9 out + Pets, 5 in)', JSON.stringify(cats) === JSON.stringify([{ type: 'expense', n: 10 }, { type: 'income', n: 5 }]), JSON.stringify(cats));
check('one Cash wallet', (await q(`select count(*)::int n from public.wallets`))[0].n === 1);

// 3. Old app still works between the two migrations (inserts via the old PIN function)
await db.exec(`set role anon;`);
const added = await q(`select * from public.add_transaction('111111', 'expense', 10, 'Food', null, '2026-10-05')`);
await db.exec(`reset role;`);
const oldRow = (await q(`select t.note, c.name, w.name wallet from public.transactions t join public.categories c on c.id=t.category_id join public.wallets w on w.id=t.wallet_id where t.id = $1`, [added[0].id]))[0];
check('old app can still add (trigger fills category, wallet, note)', oldRow && oldRow.name === 'Food' && oldRow.wallet === 'Cash' && oldRow.note === 'Food', JSON.stringify(oldRow));

// 4. Constraints
const fails = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };
check('note longer than 80 rejected', await fails(`insert into public.transactions (type, amount, category, note) values ('expense', 1, 'Food', repeat('x', 81))`));
check('bad payment mode rejected', await fails(`insert into public.transactions (type, amount, category, note, payment_mode) values ('expense', 1, 'Food', 'x', 'Cheque')`));
check('zero amount rejected', await fails(`insert into public.transactions (type, amount, category, note) values ('expense', 0, 'Food', 'x')`));

// 5. Wrong-PIN limits: 5 per device/IP per 15 min, 20 for everyone per hour
await db.exec(`set role service_role;`);
const begin = async (client) => (await q(`select * from public.pin_begin_attempt($1)`, [client]))[0];
const finish = (id, ok) => q(`select public.pin_finish_attempt($1, $2)`, [id, ok]);
const a = [];
for (let i = 0; i < 6; i++) a.push(await begin('ip:attacker'));
check('per IP: 5 attempts allowed, 6th blocked ~15 min', a.slice(0, 5).every((x) => x.allowed && x.attempt_id) && !a[5].allowed && a[5].scope === 'client' && a[5].retry_after_seconds > 890 && a[5].retry_after_seconds <= 900, JSON.stringify(a[5]));
const mine = await begin('device:owner');
check('another device is not locked out by the attacker', mine.allowed === true);
await finish(mine.attempt_id, true);

// A correct PIN clears that device's earlier wrong attempts
const typos = [];
for (let i = 0; i < 4; i++) typos.push(await begin('device:owner'));
const right = await begin('device:owner');
await finish(right.attempt_id, true);
check('correct PIN clears the device\'s wrong attempts', (await q(`select count(*)::int n from public.pin_attempts where client_key = 'device:owner'`))[0].n === 0);

// Global: 20 wrong in an hour from many IPs (each under its own limit) blocks everyone
await q(`delete from public.pin_attempts`);
for (let ip = 0; ip < 5; ip++) for (let i = 0; i < 4; i++) await begin('ip:bot' + ip);
const g = await begin('device:owner');
check('global: 20 wrong PINs from 5 IPs block a new device, ~60 min', !g.allowed && g.scope === 'global' && g.retry_after_seconds > 3590 && g.retry_after_seconds <= 3600, JSON.stringify(g));
check('blocked attempts are not recorded', (await q(`select count(*)::int n from public.pin_attempts`))[0].n === 20);

// Old attempts leave the window
await q(`update public.pin_attempts set created_at = now() - interval '61 minutes'`);
check('after an hour, attempts are allowed again', (await begin('device:owner')).allowed === true);
await q(`update public.pin_attempts set created_at = now() - interval '2 days'`);
await begin('ip:cleanup');
check('attempts older than a day are deleted', (await q(`select count(*)::int n from public.pin_attempts`))[0].n === 1);
await q(`delete from public.pin_attempts`);
await db.exec(`reset role;`);

// 6. anon / authenticated have no access to new tables or PIN functions
const denied = async (role, sql) => { await db.exec(`set role ${role};`); const r = await fails(sql); await db.exec('reset role;'); return r; };
for (const role of ['anon', 'authenticated']) {
  const all = [];
  for (const t of ['transactions', 'categories', 'wallets', 'quick_adds', 'app_settings', 'pin_attempts']) all.push(await denied(role, `select * from public.${t}`));
  all.push(await denied(role, `select * from public.pin_begin_attempt('ip:x')`));
  all.push(await denied(role, `select public.pin_finish_attempt(1, true)`));
  check(`${role}: no access to tables or PIN functions`, all.every(Boolean));
}
const rls = await q(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`);
check('RLS on for every table', rls.every((r) => r.relrowsecurity), rls.map((r) => r.relname).join(','));
const pol = (await q(`select count(*)::int n from pg_policies where schemaname='public'`))[0].n;
check('no policies', pol === 0);

// 7. Remove-old-RPC migration, twice
await db.exec(M2);
await db.exec(M2);
check('remove-old-RPC migration runs twice without error', true);
const fns = await q(`select n.nspname || '.' || p.proname f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1`);
check('only the new functions remain', JSON.stringify(fns.map((f) => f.f)) === JSON.stringify(['public.pin_begin_attempt', 'public.pin_finish_attempt', 'public.transactions_fill_defaults']), fns.map((f) => f.f).join(','));
check('private schema, app_secret and old sequences gone',
  (await q(`select count(*)::int n from pg_namespace where nspname='private'`))[0].n === 0 &&
  (await q(`select to_regclass('public.app_secret') is null as a, to_regclass('public.pin_fail_count') is null as b`))[0].a);
check('entries still all there after cleanup', (await q(`select count(*)::int n from public.transactions`))[0].n === before.length + 1);
await db.exec(`set role service_role;`);
check('service_role can still use the PIN limit functions', (await q(`select * from public.pin_begin_attempt('ip:after-cleanup')`))[0].allowed === true);
await db.exec(`reset role;`);

// 8. A database that ran the earlier draft of the migration upgrades cleanly
const draft = new PGlite({ extensions: { pgcrypto } });
await draft.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema extensions;`);
await draft.exec(`create table public.pin_lockout (id int primary key default 1, failures int not null default 0, locked_until timestamptz, updated_at timestamptz not null default now());
  create function public.pin_begin_attempt(p_max int default 5, p_lock_minutes int default 15) returns table (allowed boolean, retry_after_seconds int) language sql as $$ select true, 0 $$;
  create function public.pin_reset_attempts() returns void language sql as $$ select $$;`);
await draft.exec(M1);
const draftFns = (await draft.query(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'pin_%' order by 1`)).rows.map((r) => r.f);
check('earlier draft: old lockout removed, new functions in place',
  JSON.stringify(draftFns) === JSON.stringify(['pin_begin_attempt(p_client text, p_client_max integer, p_client_minutes integer, p_global_max integer, p_global_minutes integer)', 'pin_finish_attempt(p_attempt_id bigint, p_success boolean)'])
  && (await draft.query(`select to_regclass('public.pin_lockout') is null as gone`)).rows[0].gone, draftFns.join(' | '));

// 9. Fresh, empty project: migrations alone
const fresh = new PGlite({ extensions: { pgcrypto } });
await fresh.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema extensions;`);
await fresh.exec(M1); await fresh.exec(M1); await fresh.exec(M2); await fresh.exec(M2);
const freshCats = (await fresh.query(`select count(*)::int n from public.categories`)).rows[0].n;
check('fresh empty project: both migrations run twice, 14 default categories', freshCats === 14, String(freshCats));

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
