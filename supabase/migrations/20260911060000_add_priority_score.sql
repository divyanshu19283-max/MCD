-- Smart Incident Intelligence: adds the automated Priority/Impact Score
-- (0-100) and its human-readable reasoning, computed once per complaint at
-- submission time by classifyComplaint() alongside severity/problem/etc.
ALTER TABLE public.complaints
  ADD COLUMN priority_score integer NOT NULL DEFAULT 0,
  ADD COLUMN priority_reasoning text NOT NULL DEFAULT '';

-- Backfill existing rows (seed data + anything created before this column
-- existed) with a reasonable estimate derived from their already-stored
-- severity, so historical complaints aren't left showing a 0 score. Every
-- complaint created from now on gets the full breakdown (severity,
-- estimated people affected, duration, location risk) computed by the app.
UPDATE public.complaints SET
  priority_score = CASE severity
    WHEN 'Critical' THEN 82
    WHEN 'High' THEN 58
    WHEN 'Medium' THEN 35
    ELSE 15
  END,
  priority_reasoning = 'Estimated from ' || severity ||
    ' severity at the time this column was added — reports filed from now on ' ||
    'get a full score breakdown covering severity, estimated people affected, ' ||
    'duration and location risk.'
WHERE priority_score = 0;
