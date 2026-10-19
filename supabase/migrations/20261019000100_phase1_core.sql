-- Money Tracker (Next.js) — Phase 1: core tables.
--
-- * Keeps every existing row in public.transactions. New columns get defaults
--   and are back-filled (category, wallet, payment mode, note).
-- * Safe to run more than once, and safe on an empty project (it creates the
--   base table if it doesn't exist yet).
-- * Every table has Row Level Security ON and NO policies. Only the server
--   (secret / service_role key) can read or write.
-- * The old anon-callable PIN functions are NOT removed here. That happens in
--   the next migration, after the data has been checked.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Base table (same shape as the old app, in case this project is new)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null,
  note        text check (note is null or char_length(note) <= 80),
  txn_date    date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Categories (custom, with icon + colour, can be hidden)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('income', 'expense')),
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  icon        text not null default 'circle',
  color       text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  hidden      boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists categories_type_name_key on public.categories (type, lower(name));

insert into public.categories (type, name, icon, color, sort_order) values
  ('expense', 'Food',      'utensils',        '#f97316', 10),
  ('expense', 'Travel',    'car',             '#0ea5e9', 20),
  ('expense', 'Groceries', 'shopping-basket', '#22c55e', 30),
  ('expense', 'Shopping',  'shopping-bag',    '#ec4899', 40),
  ('expense', 'Bills',     'receipt',         '#eab308', 50),
  ('expense', 'Rent',      'house',           '#8b5cf6', 60),
  ('expense', 'Health',    'heart-pulse',     '#ef4444', 70),
  ('expense', 'Fun',       'party-popper',    '#14b8a6', 80),
  ('expense', 'Other',     'ellipsis',        '#64748b', 90),
  ('income',  'Salary',    'briefcase',       '#16a34a', 10),
  ('income',  'Freelance', 'laptop',          '#0891b2', 20),
  ('income',  'Gift',      'gift',            '#db2777', 30),
  ('income',  'Refund',    'undo-2',          '#2563eb', 40),
  ('income',  'Other',     'ellipsis',        '#64748b', 90)
on conflict (type, lower(name)) do nothing;

-- Any category name already used by existing entries becomes a real category.
insert into public.categories (type, name, sort_order)
select distinct t.type, left(btrim(t.category), 30), 100
from public.transactions t
where btrim(coalesce(t.category, '')) <> ''
on conflict (type, lower(name)) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Wallets (Phase 4 adds balances; Phase 1 needs one to pick)
-- ---------------------------------------------------------------------------
create table if not exists public.wallets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 1 and 30),
  kind             text not null default 'cash' check (kind in ('cash', 'bank', 'card', 'other')),
  opening_balance  numeric(12, 2) not null default 0,
  hidden           boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create unique index if not exists wallets_name_key on public.wallets (lower(name));

insert into public.wallets (name, kind, sort_order) values ('Cash', 'cash', 10)
on conflict (lower(name)) do nothing;

-- ---------------------------------------------------------------------------
-- 4. New transaction columns, with defaults for existing rows
-- ---------------------------------------------------------------------------
alter table public.transactions add column if not exists category_id  uuid references public.categories (id);
alter table public.transactions add column if not exists wallet_id    uuid references public.wallets (id);
alter table public.transactions add column if not exists payment_mode text not null default 'Cash';
alter table public.transactions add column if not exists tags         text[] not null default '{}';
alter table public.transactions add column if not exists updated_at   timestamptz not null default now();
alter table public.transactions add column if not exists deleted_at   timestamptz;  -- soft delete (Undo)

alter table public.transactions drop constraint if exists transactions_payment_mode_check;
alter table public.transactions add constraint transactions_payment_mode_check
  check (payment_mode in ('Cash', 'UPI', 'Card', 'Bank'));

-- Back-fill: category_id from the old category name
update public.transactions t
   set category_id = c.id
  from public.categories c
 where t.category_id is null
   and c.type = t.type
   and lower(c.name) = lower(left(btrim(t.category), 30));

-- Back-fill: wallet = Cash
update public.transactions
   set wallet_id = (select id from public.wallets where lower(name) = 'cash')
 where wallet_id is null;

-- Back-fill: the note is now required (1–80 characters). Empty notes get the category name.
update public.transactions
   set note = left(coalesce(nullif(btrim(category), ''), 'Entry'), 80)
 where note is null or btrim(note) = '';

alter table public.transactions alter column note set not null;
alter table public.transactions drop constraint if exists transactions_note_length_check;
alter table public.transactions add constraint transactions_note_length_check
  check (char_length(btrim(note)) between 1 and 80);

-- Keeps the columns consistent for any writer (including the old PIN functions
-- until they are removed): fills category_id / wallet / note when missing and
-- keeps the old "category" text column equal to the category's name.
create or replace function public.transactions_fill_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is null then
    select id into new.category_id from public.categories
     where type = new.type and lower(name) = lower(left(btrim(coalesce(new.category, '')), 30));
    if new.category_id is null then
      select id into new.category_id from public.categories
       where type = new.type and lower(name) = 'other';
    end if;
  end if;
  if new.category_id is not null then
    select name into new.category from public.categories where id = new.category_id;
  end if;
  if new.wallet_id is null then
    select id into new.wallet_id from public.wallets where lower(name) = 'cash';
  end if;
  if new.note is null or btrim(new.note) = '' then
    new.note := left(coalesce(nullif(btrim(new.category), ''), 'Entry'), 80);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transactions_fill_defaults on public.transactions;
create trigger transactions_fill_defaults
  before insert or update on public.transactions
  for each row execute function public.transactions_fill_defaults();

alter table public.transactions alter column category_id set not null;
alter table public.transactions alter column wallet_id set not null;

create index if not exists transactions_active_date_idx
  on public.transactions (txn_date desc, created_at desc) where deleted_at is null;
create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_wallet_idx on public.transactions (wallet_id);

-- ---------------------------------------------------------------------------
-- 5. Quick-add presets ("Tea ₹20 · Food · Cash")
-- ---------------------------------------------------------------------------
create table if not exists public.quick_adds (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('income', 'expense')),
  amount        numeric(12, 2) not null check (amount > 0),
  category_id   uuid not null references public.categories (id),
  note          text not null check (char_length(btrim(note)) between 1 and 80),
  payment_mode  text not null default 'Cash' check (payment_mode in ('Cash', 'UPI', 'Card', 'Bank')),
  wallet_id     uuid not null references public.wallets (id),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. App settings (key/value): last payment mode, monthly budget, ...
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key check (char_length(key) between 1 and 60),
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Wrong-PIN limits. The PIN hash itself lives in the PIN_HASH environment
--    variable, not here.
--    * 5 wrong PINs per device/IP in 15 minutes blocks that device/IP only,
--      so a stranger can't lock you out of your own devices.
--    * 20 wrong PINs from anywhere in 60 minutes blocks new PIN entries for
--      everyone (a backstop against guessing from many IPs).
--    Device/IP keys arrive already hashed by the server.
-- ---------------------------------------------------------------------------
-- An earlier draft of this file used a single global counter; remove it if present.
drop function if exists public.pin_begin_attempt(int, int);
drop function if exists public.pin_reset_attempts();
drop table if exists public.pin_lockout;

create table if not exists public.pin_attempts (
  id          bigint generated always as identity primary key,
  client_key  text not null check (char_length(client_key) between 1 and 100),
  created_at  timestamptz not null default now()
);
create index if not exists pin_attempts_client_time_idx on public.pin_attempts (client_key, created_at desc);
create index if not exists pin_attempts_time_idx on public.pin_attempts (created_at desc);

-- Called before every PIN check. Each attempt is recorded up front and counts as
-- wrong until pin_finish_attempt says it was correct, and checks run one at a
-- time, so parallel guesses can't get past the limits.
create or replace function public.pin_begin_attempt(
  p_client text,
  p_client_max int default 5,
  p_client_minutes int default 15,
  p_global_max int default 20,
  p_global_minutes int default 60)
returns table (allowed boolean, scope text, retry_after_seconds int, attempt_id bigint)
language plpgsql
set search_path = public
as $$
declare
  v_now    timestamptz := clock_timestamp();
  v_oldest timestamptz;
  v_id     bigint;
begin
  perform pg_advisory_xact_lock(hashtext('money-tracker-pin-attempts'));
  delete from public.pin_attempts a where a.created_at < v_now - interval '1 day';

  -- This device/IP: blocked until its p_client_max-th most recent attempt leaves the window.
  select a.created_at into v_oldest
    from public.pin_attempts a
   where a.client_key = p_client and a.created_at > v_now - make_interval(mins => p_client_minutes)
   order by a.created_at desc
  offset p_client_max - 1 limit 1;
  if found then
    return query select false, 'client'::text,
      greatest(1, ceil(extract(epoch from (v_oldest + make_interval(mins => p_client_minutes) - v_now))))::int, null::bigint;
    return;
  end if;

  -- Everyone
  select a.created_at into v_oldest
    from public.pin_attempts a
   where a.created_at > v_now - make_interval(mins => p_global_minutes)
   order by a.created_at desc
  offset p_global_max - 1 limit 1;
  if found then
    return query select false, 'global'::text,
      greatest(1, ceil(extract(epoch from (v_oldest + make_interval(mins => p_global_minutes) - v_now))))::int, null::bigint;
    return;
  end if;

  insert into public.pin_attempts (client_key, created_at) values (p_client, v_now) returning id into v_id;
  return query select true, null::text, 0, v_id;
end;
$$;

-- A correct PIN removes that attempt and the same device/IP's earlier wrong ones.
create or replace function public.pin_finish_attempt(p_attempt_id bigint, p_success boolean)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_client text;
begin
  if not p_success then
    return;
  end if;
  delete from public.pin_attempts a where a.id = p_attempt_id returning a.client_key into v_client;
  if v_client is not null then
    delete from public.pin_attempts a where a.client_key = v_client;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Security: RLS on, no policies, no access for anon / authenticated.
--    The server uses the secret (service_role) key, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.categories   enable row level security;
alter table public.wallets      enable row level security;
alter table public.quick_adds   enable row level security;
alter table public.app_settings enable row level security;
alter table public.pin_attempts enable row level security;

revoke all on public.transactions, public.categories, public.wallets,
              public.quick_adds, public.app_settings, public.pin_attempts
  from public, anon, authenticated;
grant select, insert, update, delete on public.transactions, public.categories, public.wallets,
              public.quick_adds, public.app_settings, public.pin_attempts
  to service_role;

revoke all on function public.transactions_fill_defaults() from public, anon, authenticated;
revoke all on function public.pin_begin_attempt(text, int, int, int, int) from public, anon, authenticated;
revoke all on function public.pin_finish_attempt(bigint, boolean)          from public, anon, authenticated;
grant execute on function public.pin_begin_attempt(text, int, int, int, int) to service_role;
grant execute on function public.pin_finish_attempt(bigint, boolean)          to service_role;
