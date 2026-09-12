# LocalFix setup

If the app shows `column complaints.assigned_authority_id does not exist`, the hosted database has not received the authority-routing schema yet.

1. Open your Supabase project Dashboard.
2. Open **SQL Editor** and create a new query.
3. Copy/paste the complete contents of `SUPABASE_SETUP.sql`.
4. Run it once.
5. Restart the app (`npm run dev`).

This creates the authority directory, routing columns, routing-event timeline, indexes, realtime configuration, and Delhi authority seed data. Existing complaint rows are preserved.

The local app cannot safely create PostgreSQL tables with the publishable browser key, so this one SQL execution is required for the hosted database. No Supabase CLI is required.
