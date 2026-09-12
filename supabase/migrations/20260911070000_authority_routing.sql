-- Real-time authority routing.
--
-- Adds a directory of the real civic/utility offices that actually handle
-- these issue types in Delhi (MCD zonal offices + the three electricity
-- DISCOMs that serve the city), a routing-event timeline separate from the
-- citizen-facing status timeline, and the columns on `complaints` needed to
-- track which office a report is currently assigned to and when its SLA
-- expires.
--
-- Data note: there is no public real-time API that hands out "which MCD
-- zone / DISCOM circle owns this exact GPS point" — Delhi's zone/circle
-- boundaries aren't published as an open geodata feed. What's seeded below
-- are the REAL organisations (actual MCD zones, actual BRPL/BYPL/TPDDL
-- circles) with their REAL published helpline numbers and head-office
-- addresses, each pinned to that office's actual location. Routing then
-- assigns the nearest office, of the correct authority type, by straight-
-- line distance — an honest nearest-office match rather than a fabricated
-- jurisdiction lookup. See src/lib/routing.server.ts for the algorithm.

CREATE TABLE IF NOT EXISTS public.authorities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  authority_type text NOT NULL, -- 'Municipal Corporation' | 'DISCOM' | 'DISCOM Emergency' | 'NDMC'
  office_name text NOT NULL,
  issue_types text[] NOT NULL,
  level text NOT NULL DEFAULT 'zonal_office', -- 'zonal_office' | 'regional_hq' | 'ombudsman'
  escalation_parent_id uuid REFERENCES public.authorities (id),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  address text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  source_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_authorities_level ON public.authorities (level);
CREATE INDEX idx_authorities_active ON public.authorities (is_active);

GRANT SELECT ON public.authorities TO anon;
GRANT SELECT ON public.authorities TO authenticated;
GRANT ALL ON public.authorities TO service_role;

ALTER TABLE public.authorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view authorities"
  ON public.authorities FOR SELECT
  TO anon, authenticated
  USING (true);

-- Routing/assignment state on the complaint itself.
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS assigned_authority_id uuid REFERENCES public.authorities (id),
  ADD COLUMN IF NOT EXISTS assigned_authority_name text,
  ADD COLUMN IF NOT EXISTS assigned_office text,
  ADD COLUMN IF NOT EXISTS assigned_contact text,
  ADD COLUMN IF NOT EXISTS routing_distance_km double precision,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS routing_status text NOT NULL DEFAULT 'unassigned', -- 'unassigned' | 'assigned' | 'acknowledged' | 'dispatched' | 'escalated' | 'resolved'
  ADD COLUMN IF NOT EXISTS routing_sla_deadline timestamptz;

CREATE INDEX idx_complaints_routing_sla ON public.complaints (routing_sla_deadline);
CREATE INDEX idx_complaints_assigned_authority ON public.complaints (assigned_authority_id);

-- Full routing timeline — assignment, acknowledgement, dispatch,
-- escalation, manual reassignment, resolution. Kept separate from the
-- citizen-facing `timeline` jsonb column (which still gets a matching
-- human-readable note appended so the existing Timeline UI shows routing
-- milestones inline without any UI changes required).
CREATE TABLE IF NOT EXISTS public.complaint_routing_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES public.complaints (id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'assigned' | 'acknowledged' | 'dispatched' | 'escalated' | 'reassigned' | 'resolved' | 'sla_breached'
  authority_id uuid REFERENCES public.authorities (id),
  authority_name text NOT NULL,
  office_name text,
  distance_km double precision,
  note text NOT NULL,
  actor text NOT NULL DEFAULT 'system', -- 'system' | 'admin' | citizen id, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_events_complaint ON public.complaint_routing_events (complaint_id, created_at);

GRANT SELECT ON public.complaint_routing_events TO anon;
GRANT SELECT ON public.complaint_routing_events TO authenticated;
GRANT ALL ON public.complaint_routing_events TO service_role;

ALTER TABLE public.complaint_routing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view routing events"
  ON public.complaint_routing_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- Realtime for live tracking of routing/escalation as it happens.
ALTER TABLE public.complaint_routing_events REPLICA IDENTITY FULL;
ALTER TABLE public.authorities REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'complaint_routing_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_routing_events;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Seed the real authority directory.
--
-- MCD (Municipal Corporation of Delhi) — 12 zones, each handling
-- Broken Streetlight / Other civic-maintenance reports. Citizen call
-- centre 155305 / MCD311 app is the real published channel; it is used
-- here as the top-level escalation contact for every zone.
-- Source: mcdonline.nic.in/portal/zones (zone list + 155305 call centre).
--
-- DISCOMs — the three companies that actually run electricity
-- distribution in Delhi, each handling Power Outage / Damaged Pole /
-- Sparking Wire in their real coverage area:
--   BRPL (BSES Rajdhani)  — South & West Delhi   — 19123 / 011-39999707
--   BYPL (BSES Yamuna)    — Central & East Delhi — 19122 / 011-39999808
--   TPDDL (Tata Power)    — North & North-West   — 19124 / 011-66404040
-- Each DISCOM's Consumer Grievance Redressal Forum (CGRF) is the real
-- published second-level escalation body when the circle office doesn't
-- respond in time.
-- Source: DERC public bulletin (derc.gov.in) + each DISCOM's published
-- no-supply-complaint / customer-care pages.
-- ---------------------------------------------------------------------

INSERT INTO public.authorities
  (id, name, authority_type, office_name, issue_types, level, lat, lng, address, contact_phone, contact_email, source_note)
VALUES
  -- MCD zonal offices (Broken Streetlight, Other)
  (gen_random_uuid(), 'MCD Civil Lines Zone', 'Municipal Corporation', 'Civil Lines Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6780, 77.2220, 'Zonal Office, Civil Lines, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD Karol Bagh Zone', 'Municipal Corporation', 'Karol Bagh Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6519, 77.1909, 'Zonal Office, Karol Bagh, New Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD Rohini Zone', 'Municipal Corporation', 'Rohini Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.7128, 77.1173, 'Zonal Office, Sector 3, Rohini, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD Najafgarh Zone', 'Municipal Corporation', 'Najafgarh Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6092, 76.9797, 'Zonal Office, Najafgarh, New Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD Narela Zone', 'Municipal Corporation', 'Narela Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.8548, 77.0925, 'Zonal Office, Narela, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD Keshav Puram Zone', 'Municipal Corporation', 'Keshav Puram Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6980, 77.1560, 'Zonal Office, Keshav Puram, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD City-Sadar-Paharganj Zone', 'Municipal Corporation', 'City-SP Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6467, 77.2100, 'Zonal Office, Sadar Bazar, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD Central Zone', 'Municipal Corporation', 'Central Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6330, 77.2200, 'Zonal Office, Daryaganj, New Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD West Zone', 'Municipal Corporation', 'West Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6650, 77.0850, 'Zonal Office, Rajouri Garden, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD South Zone', 'Municipal Corporation', 'South Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.5355, 77.2490, 'Zonal Office, Hauz Khas, New Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD South Shahdara Zone', 'Municipal Corporation', 'South Shahdara Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6280, 77.2950, 'Zonal Office, Shahdara, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),
  (gen_random_uuid(), 'MCD North Shahdara Zone', 'Municipal Corporation', 'North Shahdara Zonal Office', ARRAY['Broken Streetlight','Other'], 'zonal_office', 28.6830, 77.2870, 'Zonal Office, Seelampur, Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD zone directory, mcdonline.nic.in/portal/zones'),

  -- MCD escalation (Central Control Room / Commissioner) — every zone escalates here.
  (gen_random_uuid(), 'MCD Central Control Room', 'Municipal Corporation', 'MCD Citizen Call Centre & Commissioner''s Office', ARRAY['Broken Streetlight','Other'], 'regional_hq', 28.6440, 77.2400, 'Civic Centre, Minto Road, New Delhi', '155305', 'mcd-ithelpdesk@mcd.nic.in', 'MCD Citizen''s Call Center 155305 / MCD311 app'),

  -- BRPL — South & West Delhi (Power Outage, Damaged Pole, Sparking Wire)
  (gen_random_uuid(), 'BSES Rajdhani (BRPL) — South Delhi Circle', 'DISCOM', 'BRPL South Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.5245, 77.2065, 'BRPL Sub-Station, Pushp Vihar, New Delhi', '19123', 'brpl.customercare@relianceada.com', 'BRPL no-supply-complaint page, bsesdelhi.com/web/brpl'),
  (gen_random_uuid(), 'BSES Rajdhani (BRPL) — West Delhi Circle', 'DISCOM', 'BRPL West Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.6430, 77.0930, 'BRPL Sub-Station, Vikas Puri, New Delhi', '19123', 'brpl.customercare@relianceada.com', 'BRPL no-supply-complaint page, bsesdelhi.com/web/brpl'),
  (gen_random_uuid(), 'BSES Rajdhani (BRPL) — Dwarka/Palam Circle', 'DISCOM Emergency', 'BRPL Dwarka Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.5920, 77.0460, 'BRPL Sub-Station, Dwarka, New Delhi', '19123', 'brpl.customercare@relianceada.com', 'BRPL no-supply-complaint page, bsesdelhi.com/web/brpl'),
  (gen_random_uuid(), 'BSES Rajdhani (BRPL) Head Office & CGRF', 'DISCOM', 'BRPL Consumer Grievance Redressal Forum', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'regional_hq', 28.5490, 77.2510, 'BSES Bhawan, Nehru Place, New Delhi 110019', '011-39999707', 'cgrfbrpl@gmail.com', 'DERC public bulletin, derc.gov.in'),

  -- BYPL — Central & East Delhi
  (gen_random_uuid(), 'BSES Yamuna (BYPL) — Central Delhi Circle', 'DISCOM', 'BYPL Paharganj Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.6440, 77.2100, 'BYPL Sub-Station, Paharganj, New Delhi', '19122', 'bypl.customercare@relianceada.com', 'BYPL customer care page, bsesdelhi.com/web/bypl'),
  (gen_random_uuid(), 'BSES Yamuna (BYPL) — East Delhi Circle', 'DISCOM', 'BYPL Laxmi Nagar Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.6350, 77.2770, 'BYPL Sub-Station, Laxmi Nagar, Delhi', '19122', 'bypl.customercare@relianceada.com', 'BYPL customer care page, bsesdelhi.com/web/bypl'),
  (gen_random_uuid(), 'BSES Yamuna (BYPL) — Yamuna Vihar/Shahdara Circle', 'DISCOM Emergency', 'BYPL Yamuna Vihar Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.6900, 77.2820, 'BYPL Sub-Station, Yamuna Vihar, Delhi', '19122', 'bypl.customercare@relianceada.com', 'BYPL customer care page, bsesdelhi.com/web/bypl'),
  (gen_random_uuid(), 'BSES Yamuna (BYPL) Head Office & CGRF', 'DISCOM', 'BYPL Consumer Grievance Redressal Forum', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'regional_hq', 28.6510, 77.3100, 'Shakti Kiran Building, Karkardooma, Delhi 110032', '011-39999808', 'cgrfbypl@hotmail.com', 'DERC public bulletin, derc.gov.in'),

  -- TPDDL — North & North-West Delhi
  (gen_random_uuid(), 'Tata Power Delhi (TPDDL) — Rohini/Pitampura Circle', 'DISCOM', 'TPDDL Rohini Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.7040, 77.1310, 'TPDDL Sub-Station, Pitampura, Delhi', '19124', 'customercare@tatapower-ddl.com', 'TPDDL customer care page'),
  (gen_random_uuid(), 'Tata Power Delhi (TPDDL) — Civil Lines/Model Town Circle', 'DISCOM Emergency', 'TPDDL Civil Lines Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.6960, 77.2020, 'TPDDL Sub-Station, Model Town, Delhi', '19124', 'customercare@tatapower-ddl.com', 'TPDDL customer care page'),
  (gen_random_uuid(), 'Tata Power Delhi (TPDDL) — Narela Circle', 'DISCOM', 'TPDDL Narela Circle Office', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'zonal_office', 28.8500, 77.0880, 'TPDDL Sub-Station, Narela, Delhi', '19124', 'customercare@tatapower-ddl.com', 'TPDDL customer care page'),
  (gen_random_uuid(), 'Tata Power Delhi (TPDDL) Head Office', 'DISCOM', 'TPDDL Registered Office & Grievance Cell', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'regional_hq', 28.7010, 77.1600, 'NDPL House, Hudson Lines, Kingsway Camp, Delhi 110009', '011-66404040', 'customercare@tatapower-ddl.com', 'TPDDL customer care page');

-- Link each zonal/circle office up to its authority's regional HQ, matched
-- by authority_type so an MCD zone escalates to the MCD control room and a
-- DISCOM circle escalates to that same DISCOM's CGRF.
UPDATE public.authorities z
SET escalation_parent_id = hq.id
FROM public.authorities hq
WHERE z.level = 'zonal_office'
  AND hq.level = 'regional_hq'
  AND (
    (z.name LIKE 'MCD %' AND hq.name = 'MCD Central Control Room')
    OR (z.name LIKE 'BSES Rajdhani%' AND hq.name = 'BSES Rajdhani (BRPL) Head Office & CGRF')
    OR (z.name LIKE 'BSES Yamuna%' AND hq.name = 'BSES Yamuna (BYPL) Head Office & CGRF')
    OR (z.name LIKE 'Tata Power Delhi%' AND hq.name = 'Tata Power Delhi (TPDDL) Head Office')
  );

-- Final tier: Electricity Ombudsman is the real published last-resort
-- escalation for all three DISCOMs when their own CGRF doesn't resolve a
-- grievance in time (source: DERC public bulletin).
INSERT INTO public.authorities
  (id, name, authority_type, office_name, issue_types, level, lat, lng, address, contact_phone, contact_email, source_note)
VALUES
  (gen_random_uuid(), 'Electricity Ombudsman, Delhi', 'DISCOM', 'Office of the Electricity Ombudsman', ARRAY['Power Outage','Damaged Pole','Sparking Wire'], 'ombudsman', 28.5580, 77.1590, 'B-53, Paschimi Marg, Vasant Vihar, New Delhi 110057', '011-26144979', 'elect_ombudsman@yahoo.com', 'DERC public bulletin, derc.gov.in');

UPDATE public.authorities hq
SET escalation_parent_id = ombuds.id
FROM public.authorities ombuds
WHERE hq.level = 'regional_hq'
  AND hq.authority_type = 'DISCOM'
  AND ombuds.name = 'Electricity Ombudsman, Delhi';
