CREATE SEQUENCE IF NOT EXISTS public.complaint_code_seq START WITH 1001;

CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE DEFAULT ('LF-' || nextval('public.complaint_code_seq')),
  type text NOT NULL,
  description text NOT NULL,
  photo_url text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  area text NOT NULL DEFAULT 'Pinned location',
  ward text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Reported',
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  read boolean NOT NULL DEFAULT true,
  problem text NOT NULL,
  severity text NOT NULL,
  authority text NOT NULL,
  recommended_action text NOT NULL,
  expected_by timestamptz NOT NULL,
  forwarded_at timestamptz,
  forwarded_reference text
);

CREATE INDEX idx_complaints_created_at ON public.complaints (created_at DESC);
CREATE INDEX idx_complaints_coords ON public.complaints (lat, lng);

GRANT SELECT ON public.complaints TO anon;
GRANT SELECT ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.complaint_code_seq TO service_role;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view complaints"
  ON public.complaints FOR SELECT
  TO anon, authenticated
  USING (true);

DO $$
DECLARE
  statuses text[] := ARRAY['Reported','AI Classified','Forwarded to Authority','Assigned to Field Team','Work In Progress','Resolved'];
  notes text[] := ARRAY[
    'Complaint received and logged.',
    'Automatically classified by AI — severity and routing determined.',
    'Complaint forwarded to the responsible authority.',
    'A field crew has been assigned.',
    'Crew is working on the issue.',
    'Issue fixed and closed.'
  ];
  seed jsonb := '[
    {"t":"Sparking Wire","s":"Work In Progress","dlat":0.004,"dlng":-0.006,"area":"Karol Bagh","d":"Sparking wire above the footpath near the market entrance, dangerous for children walking to school.","sev":"Critical","auth":"DISCOM Emergency Electrical Team","act":"Emergency power isolation and fire-safety team dispatched immediately.","prob":"Sparking Wire — risk near children, reported as unsafe","eta":2},
    {"t":"Broken Streetlight","s":"Resolved","dlat":-0.003,"dlng":0.005,"area":"Lajpat Nagar","d":"Streetlight outside the central market has been dark for a week.","sev":"Low","auth":"Municipal Corporation / Urban Local Body","act":"Added to the routine streetlight maintenance round.","prob":"Broken Streetlight — non-urgent maintenance issue reported","eta":168},
    {"t":"Power Outage","s":"Assigned to Field Team","dlat":0.007,"dlng":0.003,"area":"Connaught Place","d":"Whole block has been without power since early morning.","sev":"Medium","auth":"Electricity Distribution Company (DISCOM)","act":"Fault diagnosis team assigned to trace and restore power.","prob":"Power Outage — widespread impact","eta":72},
    {"t":"Damaged Pole","s":"Forwarded to Authority","dlat":-0.008,"dlng":-0.004,"area":"Saket","d":"Electricity pole is leaning dangerously over the road after last nights storm.","sev":"High","auth":"Electricity Distribution Company (DISCOM)","act":"Priority inspection and reinforcement scheduled within 24 hours.","prob":"Damaged Pole — structural instability, reported as unsafe","eta":24},
    {"t":"Broken Streetlight","s":"AI Classified","dlat":0.002,"dlng":0.009,"area":"Dwarka Sector 12","d":"Two streetlights flickering all night outside the park gate.","sev":"Low","auth":"Municipal Corporation / Urban Local Body","act":"Added to the routine streetlight maintenance round.","prob":"Broken Streetlight — non-urgent maintenance issue reported","eta":168},
    {"t":"Power Outage","s":"Resolved","dlat":-0.005,"dlng":0.007,"area":"Rohini","d":"Frequent power cuts affecting the entire society every evening.","sev":"Medium","auth":"Electricity Distribution Company (DISCOM)","act":"Fault diagnosis team assigned to trace and restore power.","prob":"Power Outage — widespread impact","eta":72},
    {"t":"Sparking Wire","s":"Reported","dlat":0.009,"dlng":-0.002,"area":"Paharganj","d":"Loose wire hanging low near the hospital gate, sparks visible at night.","sev":"Critical","auth":"DISCOM Emergency Electrical Team","act":"Emergency power isolation and fire-safety team dispatched immediately.","prob":"Sparking Wire — critical facility affected, exposed live wiring","eta":2},
    {"t":"Other","s":"Work In Progress","dlat":-0.006,"dlng":0.011,"area":"Chandni Chowk","d":"Streetlight cable hanging low over the footpath near metro gate 3.","sev":"Medium","auth":"Municipal Corporation / Urban Local Body","act":"Inspection scheduled with the civic maintenance team within the week.","prob":"Other — exposed live wiring","eta":72},
    {"t":"Damaged Pole","s":"Assigned to Field Team","dlat":0.011,"dlng":0.008,"area":"Munirka","d":"Rusted pole base near the bus depot looks unsafe, wobbles in wind.","sev":"Medium","auth":"Electricity Distribution Company (DISCOM)","act":"Pole inspection and repair scheduled with the maintenance division.","prob":"Damaged Pole — structural instability","eta":72},
    {"t":"Broken Streetlight","s":"Reported","dlat":-0.002,"dlng":-0.009,"area":"Hauz Khas","d":"Dark stretch of road outside the village entrance, feels unsafe at night.","sev":"Medium","auth":"Municipal Corporation / Urban Local Body","act":"Repair crew scheduled to attend within the week.","prob":"Broken Streetlight — reported as unsafe","eta":72}
  ]'::jsonb;
  item jsonb;
  i int := 0;
  idx int;
  k int;
  created timestamptz;
  tl jsonb;
  lat_v double precision;
  lng_v double precision;
  ward_v text;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(seed) LOOP
    i := i + 1;
    created := now() - (i * interval '9 hours');
    idx := array_position(statuses, item->>'s');
    tl := '[]'::jsonb;
    FOR k IN 1..idx LOOP
      tl := tl || jsonb_build_array(jsonb_build_object(
        'status', statuses[k],
        'at', (extract(epoch from (created + ((k - 1) * interval '3 hours'))) * 1000)::bigint,
        'note', notes[k]
      ));
    END LOOP;
    lat_v := 28.6139 + (item->>'dlat')::double precision;
    lng_v := 77.209 + (item->>'dlng')::double precision;
    ward_v := 'Ward ' || (abs(round((lat_v * 10000 + lng_v * 10000))::bigint % 250) + 1)::text;

    INSERT INTO public.complaints (
      type, description, photo_url, lat, lng, area, ward, created_at, status, timeline, read,
      problem, severity, authority, recommended_action, expected_by, forwarded_at, forwarded_reference
    ) VALUES (
      item->>'t', item->>'d', NULL, lat_v, lng_v, item->>'area', ward_v, created,
      item->>'s', tl, true, item->>'prob', item->>'sev', item->>'auth', item->>'act',
      created + ((item->>'eta')::int * interval '1 hour'),
      CASE WHEN idx >= 3 THEN created + interval '2 hours' ELSE NULL END,
      CASE WHEN idx >= 3 THEN 'REF-' || lpad(i::text, 4, '0') || '-SEED' ELSE NULL END
    );
  END LOOP;
END $$;