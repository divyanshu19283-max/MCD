-- Adds `updated_at` to complaints so the REST API can report last-modified
-- time (create/read already had `created_at`; nothing previously tracked
-- edits made via status changes, forwarding, etc).
alter table public.complaints
  add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows so updated_at starts out consistent with created_at
-- rather than "now" for old data.
update public.complaints set updated_at = created_at where updated_at = now();

create or replace function public.set_complaints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_complaints_updated_at on public.complaints;
create trigger trg_complaints_updated_at
  before update on public.complaints
  for each row
  execute function public.set_complaints_updated_at();
