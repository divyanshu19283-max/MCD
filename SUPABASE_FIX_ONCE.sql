-- LocalFix: one-time schema repair for the CURRENT Supabase project.
-- Safe to run multiple times. It does NOT recreate public.complaints.

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS citizen_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_reasoning text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_authority_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_authority_name text,
  ADD COLUMN IF NOT EXISTS assigned_office text,
  ADD COLUMN IF NOT EXISTS assigned_contact text,
  ADD COLUMN IF NOT EXISTS routing_distance_km double precision,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS routing_status text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS routing_sla_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS mcd_category_id integer,
  ADD COLUMN IF NOT EXISTS mcd_subcategory_id integer;

CREATE INDEX IF NOT EXISTS idx_complaints_citizen_id
  ON public.complaints (citizen_id);
CREATE INDEX IF NOT EXISTS complaints_mcd_category_idx
  ON public.complaints (mcd_category_id);
CREATE INDEX IF NOT EXISTS complaints_mcd_subcategory_idx
  ON public.complaints (mcd_subcategory_id);

-- Keep updated_at current for future status/assignment updates.
CREATE OR REPLACE FUNCTION public.set_complaints_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaints_updated_at ON public.complaints;
CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.set_complaints_updated_at();

-- Service-role API used by LocalFix needs full access.
GRANT ALL ON public.complaints TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Force PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';

-- Verification: this must return all 14 columns below.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'complaints'
  AND column_name IN (
    'citizen_id','updated_at','priority_score','priority_reasoning',
    'assigned_authority_id','assigned_authority_name','assigned_office',
    'assigned_contact','routing_distance_km','escalation_level',
    'routing_status','routing_sla_deadline','mcd_category_id','mcd_subcategory_id'
  )
ORDER BY column_name;
