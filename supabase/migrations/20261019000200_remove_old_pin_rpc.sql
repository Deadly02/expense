-- Money Tracker (Next.js) — remove the old anon-callable PIN functions.
--
-- RUN THIS ONLY AFTER the Phase 1 migration has been applied AND you've checked
-- that all your entries are still there (README → "Run the migrations").
-- After this, the old single-file app (index.html) stops working; the Next.js
-- app does not need any of these objects. Safe to run more than once.

-- 1. Old app functions (public wrappers + private PIN-checked versions)
drop function if exists public.list_transactions(text, date, date);
drop function if exists public.add_transaction(text, text, numeric, text, text, date);
drop function if exists public.update_transaction(text, uuid, text, numeric, text, text, date);
drop function if exists public.delete_transaction(text, uuid);
drop function if exists public._check_pin(text);

drop function if exists private.list_transactions(text, date, date);
drop function if exists private.add_transaction(text, text, numeric, text, text, date);
drop function if exists private.update_transaction(text, uuid, text, numeric, text, text, date);
drop function if exists private.delete_transaction(text, uuid);
drop function if exists private._check_pin(text);
drop schema if exists private;  -- only drops it if nothing else is in it

-- 2. Old PIN storage and wrong-PIN counters (the PIN now lives in PIN_HASH)
drop table if exists public.app_secret;
drop sequence if exists public.pin_fail_count;
drop sequence if exists public.pin_fail_since;

-- 3. No access at all for the public (anon) and logged-in (authenticated) API roles
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- ...including tables and functions created later
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
