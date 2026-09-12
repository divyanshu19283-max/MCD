# LocalFix — fix the 500 error once

The error `Could not find the 'citizen_id' column of 'complaints' in the schema cache` means the running server is talking to a Supabase project whose PostgREST schema does not contain the column.

## 1. Run the SQL once

Open the **LocalFix** Supabase project (`xjgugrorkufsqyoptfue`) → SQL Editor and run the entire file:

`SUPABASE_FIX_ONCE.sql`

It is idempotent: it does not recreate `public.complaints` and is safe to run again.

## 2. Make the app use that exact Supabase project

In the project `.env` file, use:

```env
SUPABASE_URL=https://xjgugrorkufsqyoptfue.supabase.co
VITE_SUPABASE_URL=https://xjgugrorkufsqyoptfue.supabase.co
```

Then fill in your existing publishable/anon key and, preferably, the service-role key in `SUPABASE_SERVICE_ROLE_KEY`.

**Never paste the service-role key into chat or commit it to Git.**

## 3. Fully restart the dev server

Stop Vite completely (`Ctrl+C`), then start it again. Environment variables are read when the server starts.

For npm:

```cmd
npm run dev
```

For Bun:

```cmd
bun dev
```

## 4. Clear the old browser session only if needed

The citizen ID is stored in browser localStorage. Do not delete the database. If the old page is still cached, hard-refresh with `Ctrl+Shift+R`.

## 5. Expected result

- `GET /api/complaints?...&citizen_id=...` returns 200.
- Submitting a report returns 200 and creates one row in `public.complaints` with `citizen_id`.
- Ordinary reports are private to the submitting browser.
- High/Critical reports can appear in Major Reports/Nearby according to the app rules.
- No `citizen_id` schema-cache 500 should remain.

If the same exact error appears after these steps, the server's `.env` is still pointing at a different Supabase project. The URL is the first thing to check; do not run `CREATE TABLE public.complaints` again.
