-- Closes the loop on the complaint lifecycle:
--   1. Lets the citizen confirm a "Resolved" complaint is actually fixed, or
--      reopen it if it isn't — closing the "Citizen confirms resolution" /
--      "System records outcome" gap in the product flow.
--   2. Turns on Supabase Realtime for the complaints table so subscribed
--      clients receive live INSERT/UPDATE events instead of only seeing
--      changes after their own actions invalidate the query cache.

alter table public.complaints
  add column if not exists citizen_confirmed_at timestamptz,
  add column if not exists reopened_count integer not null default 0;

comment on column public.complaints.citizen_confirmed_at is
  'Set when the citizen confirms a Resolved complaint is actually fixed. Null until confirmed.';
comment on column public.complaints.reopened_count is
  'Incremented each time a citizen reports a Resolved complaint as not actually fixed.';

-- Realtime needs full row data on UPDATE (not just changed columns) so
-- subscribed clients can reconcile the whole record from one event.
alter table public.complaints replica identity full;

-- Add the table to the realtime publication so postgres_changes events
-- (insert/update) are broadcast to subscribed clients. Guarded so re-running
-- this migration (or a resurrected environment) doesn't error if it's
-- already a member.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'complaints'
  ) then
    alter publication supabase_realtime add table public.complaints;
  end if;
end $$;
