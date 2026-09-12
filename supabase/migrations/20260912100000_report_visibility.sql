-- Report visibility: a citizen's ordinary reports are private to that browser,
-- while High/Critical reports can be surfaced in the public Major Reports view.
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS citizen_id text;

CREATE INDEX IF NOT EXISTS idx_complaints_citizen_id ON public.complaints (citizen_id);
