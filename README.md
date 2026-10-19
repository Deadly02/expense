# Money Tracker

Your personal money tracker, rebuilt as a Next.js app. It's protected by a PIN, keeps its data in Supabase, and runs on Vercel. Indian format throughout: ₹1,25,000, dates as DD-MM-YYYY, weeks Monday to Sunday.

**Status:** Phase 1 (core) is done. Charts, budgets, money owed, wallets, receipts and offline mode come in later phases.

---

## What's in this folder

| Path | What it is |
|---|---|
| `src/app` | Pages: Home, Entries, Charts, Money owed, More, and the PIN screen |
| `src/app/actions` | Server actions. Every save checks the PIN cookie and validates input with zod |
| `src/server` | Server-only code: environment checks, PIN cookie, database access |
| `src/lib` | Money maths (integer paise), dates, validation |
| `supabase/migrations` | Database changes. Run them once, in order |
| `scripts/hash-pin.mjs` | Makes the `PIN_HASH` value from your PIN |
| `tests/unit`, `tests/e2e` | Unit tests and browser tests |
| `.env.example` | The settings the app needs. Copy it to `.env.local` |

**How it's kept safe**

- Only the server talks to the database, using the Supabase **secret** key from an environment variable. No Supabase key is ever sent to your browser.
- Every database table has Row Level Security on, with no public policies. The public (anon) key can't read or change anything.
- Your PIN is never stored. The server keeps only a bcrypt hash of it, in the `PIN_HASH` environment variable.
- After a correct PIN, the device gets a signed, httpOnly cookie for 30 days.
- **Wrong-PIN limits, so a stranger can't lock you out:**
  - 5 wrong PINs from one device or IP address block that device or IP for 15 minutes. Other people aren't affected.
  - A device that has unlocked before keeps a signed "trusted device" cookie. It has its own counter, so someone on the same Wi-Fi or mobile network can't block it.
  - As a backstop, 20 wrong PINs from anywhere in an hour block new PIN entries for everyone until the hour passes. Devices that are already unlocked keep working.
  - IP addresses are stored only as scrambled (hashed) values. On Vercel they come from Vercel itself and can't be faked.
- **Lock this device** (under More) removes the cookie on that device only.
- Changing your PIN signs out every device.

---

## 1. Run it on your computer

You need **Node.js 20.9 or newer** (from https://nodejs.org, the "LTS" button).

1. Open a terminal in this `money-tracker` folder.
2. Install the packages:

   ```bash
   npm install
   ```

3. Copy the example settings file:

   ```bash
   copy .env.example .env.local
   ```

   On Mac or Linux, use `cp .env.example .env.local`.

4. Fill in `.env.local`, following steps 2 and 3 below.
5. Start the app:

   ```bash
   npm run dev
   ```

6. Open http://localhost:3000 and enter your PIN.

`.env.local` holds your secrets. It is already listed in `.gitignore`, so it never gets committed.

## 2. Set your PIN

```bash
npm run hash-pin
```

Type your PIN twice. Your typing is hidden. Use 6 or more digits that aren't easy to guess. The script prints two lines:

```
PIN_HASH=JDJiJDEyJ...
SESSION_SECRET=q3v...
```

Paste both into `.env.local`. Later you'll paste them into Vercel too.

- `PIN_HASH` is the scrambled PIN. It's base64-encoded so the `$` signs in bcrypt hashes don't break `.env` files.
- `SESSION_SECRET` signs the login cookie. Set it once and keep it. Changing it locks every device.

**To change your PIN later:** run `npm run hash-pin` again and replace only `PIN_HASH`, locally and in Vercel. Then redeploy. Every device will ask for the new PIN.

## 3. Connect Supabase

In your Supabase project (**expence**), copy two values into `.env.local`:

- `SUPABASE_URL`: **Project Settings → Data API → Project URL**, like `https://mshkrwpxkjopbuevbnrv.supabase.co`.
- `SUPABASE_SECRET_KEY`: **Project Settings → API Keys → Secret keys**. It starts with `sb_secret_`. Create one if the list is empty.

> Never use the publishable/anon key here, and never put the secret key in a variable starting with `NEXT_PUBLIC_`. The app refuses to start if you paste the publishable key by mistake.

## 4. Run the migrations

Migrations update the database. They keep all your existing entries, and they're safe to run more than once. Run them **in order**, in **Supabase → SQL Editor → New query**:

1. Paste all of `supabase/migrations/20261019000100_phase1_core.sql` and click **Run**.

   This adds categories, wallets, quick-adds, settings and the PIN lockout. It also gives existing entries defaults. Wallet and payment mode become "Cash", and an empty note becomes the category name, because notes are now required.

2. **Check your data is all there** before going further:

   ```sql
   select count(*) as entries,
          count(*) filter (where category_id is null) as missing_category,
          count(*) filter (where wallet_id is null) as missing_wallet
   from public.transactions;
   ```

   `entries` should match what you had before. Both "missing" numbers should be 0.

3. Only after that check, paste and run `supabase/migrations/20261019000200_remove_old_pin_rpc.sql`.

   This removes the old app's public PIN functions and its stored PIN hash. It also takes away every permission the public (anon) key had. After this, the old single-file `index.html` app stops working.

Then open **Advisors → Security Advisor**. It should show no warnings. A few "RLS enabled, no policy" notes are expected, because they mean nobody but the server can touch the tables.

## 5. Put it online with Vercel

1. Put this folder on GitHub as a **private** repository.
   - Easiest way: install GitHub Desktop, choose **File → Add local repository**, pick the `money-tracker` folder, then **Publish repository** with **Keep this code private** ticked.
   - Your `.env.local` won't be uploaded.
2. Go to https://vercel.com, sign in with GitHub, then **Add New… → Project**. Import the repository.
   - If your repository contains the parent `expence` folder, set **Root Directory** to `money-tracker`.
3. Before clicking **Deploy**, open **Environment Variables** and add these four:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SECRET_KEY` | your `sb_secret_…` key |
   | `PIN_HASH` | from `npm run hash-pin` |
   | `SESSION_SECRET` | from `npm run hash-pin` |

   Optionally, add `APP_TIME_ZONE` = `Asia/Kolkata`. That's already the default.

   Do **not** add `DATA_BACKEND` or `ALLOW_TEST_RESET`. They're only for automated tests.
4. Click **Deploy**. You'll get an address like `https://money-tracker-yourname.vercel.app`.
5. For speed, go to **Settings → Functions → Function Region** and pick the region closest to your Supabase project, such as **Mumbai (bom1)**. Then redeploy.

To update the app later, push changes to GitHub. Vercel redeploys automatically.

## 6. Add it to your phone's home screen

Open your Vercel address on your phone and enter your PIN once.

- **Android (Chrome):** menu **⋮** → **Add to Home screen**.
- **iPhone (Safari):** **Share** → **Add to Home Screen**.

Phase 5 makes it a full installable app, with an icon, a full-screen view and offline entries.

---

## Using it

- **Add:** tap **+**. The amount box is ready to type. Then add a note ("What was this for?"), pick a category, and tap **Add**.
- Typing a note suggests past notes. Tap one to fill in its category, amount and payment mode.
- Payment mode and wallet remember what you used last. You can set fixed defaults in **More → Settings**.
- **Quick-adds** (More → Quick-adds) are one-tap presets like "Tea ₹20 · Food · Cash". They show on Home and in the add sheet.
- **Tap an entry** to edit it, **Repeat** it for today, or **Delete** it. Adds, repeats and deletes show an **Undo** button for 5 seconds.
- **Home** shows today's spending, this month's Money In, Money Out and Balance, a safe-to-spend amount per day, and recent entries. Safe-to-spend uses your monthly budget, or this month's income if you haven't set a budget.

## Checks and tests

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run test:db
```

```bash
npm run build
```

```bash
npm run test:e2e
```

- `npm test` runs the unit tests for money maths, dates, validation, suggestions and the wrong-PIN limits.
- `npm run test:db` runs both migrations twice on a real Postgres engine that runs inside Node (no database server needed). It checks that old entries are kept and the security rules hold.
- `npm run test:e2e` runs browser tests at phone width (400px) and laptop width, using the Chrome installed on your computer. Run `npm run build` first.
- The browser tests use a temporary in-memory database, so they never touch your real data.

## Troubleshooting

| You see… | What to do |
|---|---|
| "PIN_HASH is not set" or "doesn't look right" | Run `npm run hash-pin` and paste the whole `PIN_HASH=` value. |
| "SESSION_SECRET must be at least 32 characters" | Use the `SESSION_SECRET=` line from `npm run hash-pin`. |
| "SUPABASE_SECRET_KEY is the public key" | You copied the publishable key. Use the `sb_secret_…` key. |
| "The database isn't set up yet" | Run the migrations (step 4). |
| "Wrong PIN" after changing it | Every device needs the new PIN once. Check that Vercel has the new `PIN_HASH` and that you redeployed. |
| "Too many wrong PINs from this device…" | Wait. The block lifts on its own after 15 minutes. Another device that has unlocked before still works. |
| "Too many wrong PINs right now…" | Someone has been guessing. New PIN entries are paused for up to an hour; devices that are already unlocked keep working. If this keeps happening, change your PIN. |
| Nothing loads after a quiet week | Free Supabase projects pause when unused. Open the Supabase dashboard and click **Restore project**. |
