alter table public.complaints
  add column if not exists mcd_category_id integer,
  add column if not exists mcd_subcategory_id integer;

create index if not exists complaints_mcd_category_idx on public.complaints (mcd_category_id);
create index if not exists complaints_mcd_subcategory_idx on public.complaints (mcd_subcategory_id);
