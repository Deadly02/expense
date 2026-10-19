-- Money Tracker: database setup (secret PIN version, no Supabase Auth)
-- Paste this whole file into Supabase -> SQL Editor -> New query, then click "Run".
-- It is safe to run more than once. It does NOT contain your PIN: set that
-- separately with the snippet in README.md (Step 3).
--
-- How it is protected:
--   * The tables have Row Level Security ON and NO policies, so the public
--     anon/publishable key cannot read or write them directly.
--   * The app can only call the four functions below. Each one checks your
--     PIN against a bcrypt hash first and raises "Wrong PIN" if it doesn't match.
--   * The functions that can read the tables (SECURITY DEFINER) live in a
--     "private" schema the API doesn't expose. The app calls small wrappers in
--     "public" with the same names, which pass the call through.
--   * After 10 wrong PINs, every call is refused for 15 minutes, so nobody
--     can guess the PIN quickly.

-- 0. bcrypt (crypt / gen_salt). On Supabase it lives in the "extensions" schema.
create extension if not exists pgcrypto with schema extensions;

-- 1. The transactions table
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null,
  note        text check (note is null or char_length(note) <= 80),
  txn_date    date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Upgrade from the old login version: remove its policies and the user_id column.
drop policy if exists "Users can view their own transactions"   on public.transactions;
drop policy if exists "Users can add their own transactions"    on public.transactions;
drop policy if exists "Users can update their own transactions" on public.transactions;
drop policy if exists "Users can delete their own transactions" on public.transactions;
alter table public.transactions drop column if exists user_id;  -- also drops its old index

create index if not exists transactions_txn_date_idx
  on public.transactions (txn_date desc, created_at desc);

alter table public.transactions enable row level security;   -- no policies on purpose
revoke all on public.transactions from public, anon, authenticated;

-- 2. Private table holding the bcrypt hash of your PIN (one row, id = 1)
create table if not exists public.app_secret (
  id          int primary key default 1 check (id = 1),
  pin_hash    text not null,
  updated_at  timestamptz not null default now()
);
alter table public.app_secret enable row level security;     -- no policies on purpose
revoke all on public.app_secret from public, anon, authenticated;

-- 3. Wrong-PIN counter. Sequences are used because their values are kept even
--    when the "Wrong PIN" error rolls the rest of the request back.
create sequence if not exists public.pin_fail_count as bigint minvalue 0 start with 0;
create sequence if not exists public.pin_fail_since as bigint minvalue 0 start with 0;  -- unix seconds
revoke all on sequence public.pin_fail_count, public.pin_fail_since from public, anon, authenticated;

-- 4. Functions (dropped first so this file can be re-run after changes)
create schema if not exists private;  -- not exposed by the Supabase API
revoke all on schema private from public;
grant usage on schema private to anon;

drop function if exists public.list_transactions(text, date, date);
drop function if exists public.add_transaction(text, text, numeric, text, text, date);
drop function if exists public.update_transaction(text, uuid, text, numeric, text, text, date);
drop function if exists public.delete_transaction(text, uuid);
drop function if exists public._check_pin(text);  -- older version of this file
drop function if exists private.list_transactions(text, date, date);
drop function if exists private.add_transaction(text, text, numeric, text, text, date);
drop function if exists private.update_transaction(text, uuid, text, numeric, text, text, date);
drop function if exists private.delete_transaction(text, uuid);
drop function if exists private._check_pin(text);

-- Internal: checks the PIN and raises an error if it is wrong. Not callable from the app.
create function private._check_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  max_fails constant int := 10;
  lock_secs constant int := 900;  -- 15 minutes
  v_now   bigint := floor(extract(epoch from clock_timestamp()));
  v_fails bigint;
  v_since bigint;
  v_hash  text;
begin
  -- One PIN check at a time, so parallel guesses can't slip past the counter.
  perform pg_advisory_xact_lock(hashtext('money-tracker-pin'));

  select last_value into v_fails from public.pin_fail_count;
  select last_value into v_since from public.pin_fail_since;
  if v_now - v_since >= lock_secs then
    v_fails := 0;  -- the 15-minute window has passed
  end if;

  if v_fails >= max_fails then
    raise exception 'Too many wrong PINs. Try again in % min.',
      greatest(1, ceil((lock_secs - (v_now - v_since)) / 60.0)::int);
  end if;

  select pin_hash into v_hash from public.app_secret where id = 1;
  if v_hash is null then
    raise exception 'No PIN has been set yet. Follow Step 3 of README.md.';
  end if;

  if p_pin is null or extensions.crypt(p_pin, v_hash) is distinct from v_hash then
    if v_fails = 0 then
      perform setval('public.pin_fail_since', v_now);
    end if;
    perform setval('public.pin_fail_count', v_fails + 1);
    raise exception 'Wrong PIN' using errcode = '28P01';
  end if;

  if v_fails > 0 then
    perform setval('public.pin_fail_count', 0);
  end if;
end;
$$;

create function private.list_transactions(p_pin text, p_from date, p_to date)
returns setof public.transactions
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private._check_pin(p_pin);
  return query
    select t.* from public.transactions t
    where t.txn_date between p_from and p_to
    order by t.txn_date desc, t.created_at desc, t.id;
end;
$$;

create function private.add_transaction(
  p_pin text, p_type text, p_amount numeric, p_category text, p_note text, p_date date)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.transactions;
begin
  perform private._check_pin(p_pin);
  insert into public.transactions (type, amount, category, note, txn_date)
  values (p_type, p_amount, nullif(btrim(p_category), ''), nullif(btrim(p_note), ''),
          coalesce(p_date, current_date))
  returning * into v_row;
  return v_row;
end;
$$;

create function private.update_transaction(
  p_pin text, p_id uuid, p_type text, p_amount numeric, p_category text, p_note text, p_date date)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.transactions;
begin
  perform private._check_pin(p_pin);
  update public.transactions
     set type = p_type,
         amount = p_amount,
         category = nullif(btrim(p_category), ''),
         note = nullif(btrim(p_note), ''),
         txn_date = coalesce(p_date, txn_date)
   where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create function private.delete_transaction(p_pin text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private._check_pin(p_pin);
  delete from public.transactions where id = p_id;
end;
$$;

-- 5. The four functions the app calls. They run with the caller's (anon) rights
--    and only pass the call to the PIN-checked private functions above.
create function public.list_transactions(p_pin text, p_from date, p_to date)
returns setof public.transactions
language sql
set search_path = public
as $$ select * from private.list_transactions(p_pin, p_from, p_to) $$;

create function public.add_transaction(
  p_pin text, p_type text, p_amount numeric, p_category text, p_note text, p_date date)
returns public.transactions
language sql
set search_path = public
as $$ select * from private.add_transaction(p_pin, p_type, p_amount, p_category, p_note, p_date) $$;

create function public.update_transaction(
  p_pin text, p_id uuid, p_type text, p_amount numeric, p_category text, p_note text, p_date date)
returns public.transactions
language sql
set search_path = public
as $$ select * from private.update_transaction(p_pin, p_id, p_type, p_amount, p_category, p_note, p_date) $$;

create function public.delete_transaction(p_pin text, p_id uuid)
returns void
language sql
set search_path = public
as $$ select private.delete_transaction(p_pin, p_id) $$;

-- 6. Who may call what: only these functions, only with the anon key.
revoke all on function private._check_pin(text) from public, anon, authenticated;

revoke all on function private.list_transactions(text, date, date)                            from public, anon, authenticated;
revoke all on function private.add_transaction(text, text, numeric, text, text, date)          from public, anon, authenticated;
revoke all on function private.update_transaction(text, uuid, text, numeric, text, text, date) from public, anon, authenticated;
revoke all on function private.delete_transaction(text, uuid)                                  from public, anon, authenticated;
grant execute on function private.list_transactions(text, date, date)                            to anon;
grant execute on function private.add_transaction(text, text, numeric, text, text, date)          to anon;
grant execute on function private.update_transaction(text, uuid, text, numeric, text, text, date) to anon;
grant execute on function private.delete_transaction(text, uuid)                                  to anon;

revoke all on function public.list_transactions(text, date, date)                            from public, anon, authenticated;
revoke all on function public.add_transaction(text, text, numeric, text, text, date)          from public, anon, authenticated;
revoke all on function public.update_transaction(text, uuid, text, numeric, text, text, date) from public, anon, authenticated;
revoke all on function public.delete_transaction(text, uuid)                                  from public, anon, authenticated;
grant execute on function public.list_transactions(text, date, date)                            to anon;
grant execute on function public.add_transaction(text, text, numeric, text, text, date)          to anon;
grant execute on function public.update_transaction(text, uuid, text, numeric, text, text, date) to anon;
grant execute on function public.delete_transaction(text, uuid)                                  to anon;
