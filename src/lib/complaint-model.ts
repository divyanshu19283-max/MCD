export const ISSUE_TYPES = [
  "Broken Streetlight",
  "Power Outage",
  "Damaged Pole",
  "Sparking Wire",
  "Other",
  "Engineering Building",
  "Electrical",
  "Engineering Works",
  "Horticulture",
  "Parking Cell",
  "Veterinary",
  "Property Tax",
  "Factory License",
  "General Branch",
  "Public Health",
  "Cleanliness (Swachhta)",
  "Advertisement",
  "Birth and Death",
  "Community Service Department",
  "Education",
  "Information Technology Department",
  "Toll Tax",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export const STATUSES = [
  "Reported",
  "AI Classified",
  "Forwarded to Authority",
  "Assigned to Field Team",
  "Work In Progress",
  "Resolved",
] as const;
export type Status = (typeof STATUSES)[number];

export type StatusEvent = { status: Status; at: number; note: string };

export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type Complaint = {
  id: string;
  type: IssueType;
  description: string;
  photo: string | null;
  lat: number;
  lng: number;
  area: string;
  ward: string;
  createdAt: number;
  status: Status;
  timeline: StatusEvent[];
  read: boolean;
  /** Auto-classification, computed once at submission time. */
  problem: string;
  severity: Severity;
  authority: string;
  recommendedAction: string;
  /** Timestamp by which a first response is expected, based on severity. */
  expectedBy: number;
  /** 0–100 automated priority/impact score, computed once at submission
   * time from severity, estimated people affected, how long the issue has
   * reportedly persisted, and location risk. See priorityReasoning for the
   * breakdown. */
  priorityScore: number;
  /** Human-readable explanation of what drove priorityScore. */
  priorityReasoning: string;
  /** Set once the citizen has actually contacted the assigned authority
   * (by phone, email, or its own portal — see the Call/Email/Open
   * official page actions on the assessment panel) and recorded the real
   * reference/complaint number that authority gave back. Nothing is ever
   * sent automatically; this only reflects what the citizen reports back
   * after making real contact themselves. See recordOfficialReferenceFn. */
  forwardedAt: number | null;
  forwardedReference: string | null;
  /** Set once the citizen confirms a "Resolved" complaint is actually
   * fixed — closes the loop on the lifecycle. Null until confirmed. */
  citizenConfirmedAt: number | null;
  /** Incremented each time the citizen reports a "Resolved" complaint as
   * not actually fixed, sending it back to "Work In Progress". */
  reopenedCount: number;
  /** Real-time authority routing — set once the complaint has been matched
   * to a real office in the `authorities` directory. Null only if no
   * office in the directory covers this issue type. See
   * src/lib/routing.server.ts. */
  assignedAuthorityId: string | null;
  assignedAuthorityName: string | null;
  assignedOffice: string | null;
  assignedContact: string | null;
  routingDistanceKm: number | null;
  escalationLevel: number;
  routingStatus: RoutingStatus;
  routingSlaDeadline: number | null;
  mcdCategoryId: number | null;
  mcdSubcategoryId: number | null;
};

export const ROUTING_STATUSES = [
  "unassigned",
  "assigned",
  "acknowledged",
  "dispatched",
  "escalated",
  "resolved",
] as const;
export type RoutingStatus = (typeof ROUTING_STATUSES)[number];

export const ROUTING_STATUS_LABEL: Record<RoutingStatus, string> = {
  unassigned: "Not yet routed",
  assigned: "Assigned to authority",
  acknowledged: "Acknowledged by authority",
  dispatched: "Field team dispatched",
  escalated: "Escalated to next level",
  resolved: "Routing closed",
};

/** Real contact actions offered on the assessment panel once a complaint
 * has been routed to an office — each just opens the citizen's own
 * phone/email/browser; none of these send anything on the citizen's
 * behalf. Logged via recordHandoffFn purely so the routing timeline shows
 * that outreach happened. */
export const HANDOFF_METHODS = ["call", "email", "website", "copy"] as const;
export type HandoffMethod = (typeof HANDOFF_METHODS)[number];

export const HANDOFF_LABEL: Record<HandoffMethod, string> = {
  call: "called",
  email: "emailed",
  website: "opened the official page for",
  copy: "copied the contact details for",
};

/** Splits the combined contact label stored on a routed complaint (see
 * contactLabel in routing.server.ts — "<phone>" or "<phone> · <email>")
 * back into its parts, so UI actions (tel:/mailto: links) can address
 * each channel separately. */
export function parseAssignedContact(contact: string | null): {
  phone: string | null;
  email: string | null;
} {
  if (!contact) return { phone: null, email: null };
  const [phone, email] = contact.split(" · ");
  return { phone: phone?.trim() || null, email: email?.trim() || null };
}

/** Real published grievance/contact page for the assigned authority,
 * matched by office-name prefix the same way the authority_routing
 * migration links each zonal/circle office up to its parent — see the
 * source_note column on `authorities` for where each domain comes from.
 * Returns null (rather than guessing) when no specific official page is
 * known for the name, so the UI can just hide that button. */
export function officialPageFor(assignedAuthorityName: string | null): string | null {
  if (!assignedAuthorityName) return null;
  if (assignedAuthorityName.startsWith("MCD ")) return "https://www.mcdonline.nic.in/";
  if (assignedAuthorityName.startsWith("BSES Rajdhani")) {
    return "https://www.bsesdelhi.com/web/brpl/no-supply-complaint";
  }
  if (assignedAuthorityName.startsWith("BSES Yamuna")) {
    return "https://www.bsesdelhi.com/web/bypl/no-supply-complaint";
  }
  if (assignedAuthorityName.startsWith("Tata Power Delhi")) {
    return "https://www.tatapower-ddl.com/";
  }
  if (assignedAuthorityName.startsWith("Electricity Ombudsman")) {
    return "https://www.derc.gov.in/";
  }
  return null;
}

export const DEPARTMENT_BY_TYPE: Partial<Record<IssueType, string>> = {
  "Broken Streetlight": "Streetlighting Cell, Municipal Corporation",
  "Power Outage": "Discom Fault Control Room",
  "Damaged Pole": "Electrical Maintenance Division",
  "Sparking Wire": "Electrical Safety & Emergency Wing",
  Other: "General Civic Maintenance",
};

/**
 * Routing rules — the higher-level civic/utility body accountable for each
 * issue type, distinct from the specific DEPARTMENT_BY_TYPE team that
 * handles it day-to-day:
 *   Broken Streetlight        → Municipal Corporation / Urban Local Body
 *   Power Outage               → Electricity Distribution Company (DISCOM)
 *   Sparking / Exposed Wire    → DISCOM Emergency Electrical Team
 *   Damaged Electricity Pole   → DISCOM
 *   Road-side / public infra   → Municipal Corporation / Urban Local Body
 */
export const AUTHORITY_BY_TYPE: Partial<Record<IssueType, string>> = {
  "Broken Streetlight": "Municipal Corporation / Urban Local Body",
  "Power Outage": "Electricity Distribution Company (DISCOM)",
  "Damaged Pole": "Electricity Distribution Company (DISCOM)",
  "Sparking Wire": "DISCOM Emergency Electrical Team",
  Other: "Municipal Corporation / Urban Local Body",
};

export const SEVERITY_TONE: Record<Severity, string> = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-accent text-accent-foreground",
  High: "bg-primary text-primary-foreground",
  Critical: "bg-destructive text-destructive-foreground",
};

/** Baseline severity score (0=Low..3=Critical) per issue type before any
 * hazard keywords found in the description bump it up. */
const BASE_SEVERITY_SCORE: Partial<Record<IssueType, number>> = {
  "Sparking Wire": 2,
  "Damaged Pole": 1,
  "Power Outage": 1,
  "Broken Streetlight": 0,
  Other: 0,
};

type HazardFlag = { keywords: string[]; label: string; weight: number };

/** Keyword-driven hazard signals scanned from the free-text description.
 * Each match both nudges the severity score up and feeds the "problem
 * detected" summary shown to the user. */
const HAZARD_FLAGS: HazardFlag[] = [
  { keywords: ["fire", "burn", "burning", "smoke"], label: "fire risk", weight: 2 },
  { keywords: ["shock", "electrocut"], label: "electric shock risk", weight: 2 },
  { keywords: ["child", "children", "kids", "school"], label: "risk near children", weight: 2 },
  { keywords: ["hospital", "clinic"], label: "critical facility affected", weight: 2 },
  {
    keywords: ["collapse", "collapsed", "fell", "fallen"],
    label: "structure has fallen",
    weight: 2,
  },
  { keywords: ["danger", "dangerous", "unsafe", "risky"], label: "reported as unsafe", weight: 1 },
  { keywords: ["leaning", "tilt", "tilted", "wobbl"], label: "structural instability", weight: 1 },
  {
    keywords: ["expose", "exposed", "live wire", "loose wire", "hanging low", "hanging wire"],
    label: "exposed live wiring",
    weight: 1,
  },
  {
    keywords: ["whole", "entire", "everyone", "market", "block", "society", "complex"],
    label: "widespread impact",
    weight: 1,
  },
];

const DEFAULT_PROBLEM_CLAUSE: Record<Severity, string> = {
  Critical: "immediate safety hazard reported",
  High: "hazardous condition requiring urgent attention",
  Medium: "service-affecting issue reported",
  Low: "non-urgent maintenance issue reported",
};

const RECOMMENDED_ACTION: Partial<Record<IssueType, Record<Severity, string>>> = {
  "Broken Streetlight": {
    Critical: "Emergency crew dispatched immediately to make the fixture safe.",
    High: "Priority repair crew assigned, targeting a fix within 24 hours.",
    Medium: "Repair crew scheduled to attend within the week.",
    Low: "Added to the routine streetlight maintenance round.",
  },
  "Power Outage": {
    Critical: "Emergency fault team dispatched immediately to restore supply.",
    High: "Priority restoration crew assigned, working to restore supply urgently.",
    Medium: "Fault diagnosis team assigned to trace and restore power.",
    Low: "Scheduled inspection to identify the cause of the outage.",
  },
  "Damaged Pole": {
    Critical: "Emergency structural team dispatched to secure or replace the pole immediately.",
    High: "Priority inspection and reinforcement scheduled within 24 hours.",
    Medium: "Pole inspection and repair scheduled with the maintenance division.",
    Low: "Added to the routine infrastructure inspection round.",
  },
  "Sparking Wire": {
    Critical: "Emergency power isolation and fire-safety team dispatched immediately.",
    High: "Urgent crew dispatched to isolate and repair the live wire.",
    Medium: "Electrical safety team scheduled to inspect and repair the wiring.",
    Low: "Inspection scheduled to assess the reported wiring issue.",
  },
  Other: {
    Critical: "Emergency civic response team dispatched immediately.",
    High: "Priority inspection team assigned, targeting a response within 24 hours.",
    Medium: "Inspection scheduled with the civic maintenance team within the week.",
    Low: "Logged for routine civic maintenance follow-up.",
  },
};

/** Hours until a first response is expected, by severity. */
export const SEVERITY_RESPONSE_HOURS: Record<Severity, number> = {
  Critical: 2,
  High: 24,
  Medium: 72,
  Low: 168,
};

export function etaLabel(hours: number): string {
  if (hours < 24) return `Within ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Within ${days} day${days === 1 ? "" : "s"}`;
}

export type Classification = {
  problem: string;
  severity: Severity;
  authority: string;
  department: string;
  recommendedAction: string;
  etaHours: number;
  priorityScore: number;
  priorityReasoning: string;
};

/** Impact-score tiers — deliberately the same four labels as Severity, so
 * the score can reuse SEVERITY_TONE for its badge, but this is a distinct
 * axis: severity is "how bad is this fault", priority is "how urgently
 * should it jump the queue" once people-affected/duration/location are
 * folded in too. */
export function priorityTierFor(score: number): Severity {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 28) return "Medium";
  return "Low";
}

const SEVERITY_PRIORITY_POINTS: Record<Severity, number> = {
  Low: 8,
  Medium: 18,
  High: 30,
  Critical: 40,
};

/** Baseline estimated number of people affected per issue type, before any
 * location-risk or "widespread" language in the description scales it up. */
const BASE_PEOPLE_AFFECTED: Partial<Record<IssueType, number>> = {
  "Broken Streetlight": 30,
  "Power Outage": 90,
  "Damaged Pole": 25,
  "Sparking Wire": 40,
  Other: 20,
};

export type LocationRisk = "Low" | "Moderate" | "High" | "Critical";

/** Keyword-driven location-risk signal scanned from the free-text
 * description — checked in order, first match wins. */
const LOCATION_RISK_RULES: { keywords: string[]; risk: LocationRisk }[] = [
  { keywords: ["hospital", "clinic"], risk: "Critical" },
  { keywords: ["school", "child", "children", "kids"], risk: "High" },
  {
    keywords: [
      "market",
      "society",
      "complex",
      "block",
      "station",
      "depot",
      "crossing",
      "bridge",
      "colony",
    ],
    risk: "Moderate",
  },
];

function locationRiskFor(text: string): LocationRisk {
  for (const rule of LOCATION_RISK_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.risk;
  }
  return "Low";
}

const LOCATION_RISK_POINTS: Record<LocationRisk, number> = {
  Low: 2,
  Moderate: 8,
  High: 14,
  Critical: 20,
};

const LOCATION_RISK_PEOPLE_MULTIPLIER: Record<LocationRisk, number> = {
  Low: 1,
  Moderate: 2,
  High: 3.2,
  Critical: 4.5,
};

const WIDESPREAD_PATTERN =
  /\b(whole|entire|everyone|market|block|society|complex|colony|neighbourhood|neighborhood)\b/;

function estimatePeopleAffected(type: IssueType, text: string, locationRisk: LocationRisk): number {
  const base = BASE_PEOPLE_AFFECTED[type] ?? BASE_PEOPLE_AFFECTED.Other ?? 20;
  const widespread = WIDESPREAD_PATTERN.test(text) ? 2.5 : 1;
  return Math.max(5, Math.round(base * LOCATION_RISK_PEOPLE_MULTIPLIER[locationRisk] * widespread));
}

function peopleAffectedPoints(estimated: number): number {
  if (estimated >= 300) return 25;
  if (estimated >= 150) return 20;
  if (estimated >= 75) return 14;
  if (estimated >= 30) return 8;
  return 3;
}

export type DurationBand =
  "Just reported" | "Ongoing (hours)" | "Persisting (days)" | "Long-standing (weeks+)";

/** Keyword-driven signal for how long the issue has reportedly persisted —
 * checked in order, first match wins. Falls back to "Just reported" when
 * the description gives no duration clue. */
const DURATION_RULES: { keywords: string[]; band: DurationBand; points: number }[] = [
  { keywords: ["year", "years", "month", "months"], band: "Long-standing (weeks+)", points: 15 },
  { keywords: ["week", "weeks"], band: "Long-standing (weeks+)", points: 13 },
  {
    keywords: ["days", "few days", "two days", "three days", "since yesterday"],
    band: "Persisting (days)",
    points: 9,
  },
  {
    keywords: [
      "overnight",
      "since morning",
      "since evening",
      "since last night",
      "all night",
      "hours",
    ],
    band: "Ongoing (hours)",
    points: 5,
  },
];

function durationFor(text: string): { band: DurationBand; points: number } {
  for (const rule of DURATION_RULES) {
    if (rule.keywords.some((k) => text.includes(k)))
      return { band: rule.band, points: rule.points };
  }
  return { band: "Just reported", points: 2 };
}

/** Computes the 0–100 Priority/Impact Score and its reasoning string from
 * severity plus three further signals read from the free-text description:
 * estimated people affected, how long the issue has reportedly persisted,
 * and location risk (proximity to schools, hospitals, crowded areas). Pure
 * function of (type, severity, description) — same inputs classifyComplaint
 * already has, so it runs in the same pass with no extra network/AI call. */
function scorePriority(
  type: IssueType,
  severity: Severity,
  text: string,
): { score: number; reasoning: string } {
  const locationRisk = locationRiskFor(text);
  const duration = durationFor(text);
  const estimatedPeopleAffected = estimatePeopleAffected(type, text, locationRisk);

  const severityPts = SEVERITY_PRIORITY_POINTS[severity];
  const peoplePts = peopleAffectedPoints(estimatedPeopleAffected);
  const locationPts = LOCATION_RISK_POINTS[locationRisk];
  const durationPts = duration.points;

  const score = Math.min(100, severityPts + peoplePts + locationPts + durationPts);
  const tier = priorityTierFor(score);

  const reasoning =
    `Scored ${score}/100 (${tier} priority) — ${severity} severity (+${severityPts} pts), ` +
    `an estimated ${estimatedPeopleAffected} people affected (+${peoplePts} pts), ` +
    `${locationRisk.toLowerCase()} location risk (+${locationPts} pts), and ` +
    `${duration.band.toLowerCase()} (+${durationPts} pts).`;

  return { score, reasoning };
}

/** Deterministic, client-side auto-classification of a complaint: reads the
 * issue type and free-text description, scores severity from a baseline per
 * type plus any hazard keywords found, then derives the responsible
 * authority, owning department, a recommended action and an expected
 * first-response window. No network call — this runs the instant a
 * complaint is submitted. */
export function classifyComplaint(type: IssueType, description: string): Classification {
  const text = description.toLowerCase();
  const matched = HAZARD_FLAGS.filter((f) => f.keywords.some((k) => text.includes(k)));
  const bump = matched.reduce((sum, f) => sum + f.weight, 0);
  const scoreIndex = Math.max(0, Math.min(SEVERITIES.length - 1, (BASE_SEVERITY_SCORE[type] ?? BASE_SEVERITY_SCORE.Other ?? 0) + bump));
  const severity = SEVERITIES[scoreIndex]!;

  const hazardLabels = [...new Set(matched.map((f) => f.label))];
  const problem =
    hazardLabels.length > 0
      ? `${type} — ${hazardLabels.slice(0, 2).join(", ")}`
      : `${type} — ${DEFAULT_PROBLEM_CLAUSE[severity]}`;

  const { score: priorityScore, reasoning: priorityReasoning } = scorePriority(
    type,
    severity,
    text,
  );

  return {
    problem,
    severity,
    authority: AUTHORITY_BY_TYPE[type] ?? "Municipal Corporation of Delhi",
    department: DEPARTMENT_BY_TYPE[type] ?? "MCD civic services",
    recommendedAction: (RECOMMENDED_ACTION[type] ?? RECOMMENDED_ACTION.Other!)[severity],
    etaHours: SEVERITY_RESPONSE_HOURS[severity],
    priorityScore,
    priorityReasoning,
  };
}

/** Deterministic pseudo ward number derived from a location, so every
 * complaint (seeded or newly reported) can show a plausible civic ward
 * without needing a geocoding backend. */
export function wardFor(lat: number, lng: number): string {
  const seedNum = Math.abs(Math.round((lat * 10000 + lng * 10000) % 250));
  return `Ward ${seedNum + 1}`;
}

export const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

/** Deterministic demo dataset used to seed the database the first time it's
 * used, and to reseed it via the "reset demo data" action. Exported for the
 * server-side persistence layer (src/lib/server/complaints.server.ts). */
export function seedComplaints(): Complaint[] {
  const now = Date.now();
  const mk = (
    i: number,
    type: IssueType,
    status: Status,
    dLat: number,
    dLng: number,
    area: string,
    description: string,
  ): Complaint => {
    const created = now - (i + 1) * 1000 * 60 * 60 * 9;
    const idx = STATUSES.indexOf(status);
    const lat = DEFAULT_CENTER[0] + dLat;
    const lng = DEFAULT_CENTER[1] + dLng;
    const cls = classifyComplaint(type, description);
    return {
      id: `VF-${String(1000 + i)}`,
      type,
      description,
      photo: null,
      lat,
      lng,
      area,
      ward: wardFor(lat, lng),
      createdAt: created,
      status,
      timeline: STATUSES.slice(0, idx + 1).map((s, n) => ({
        status: s,
        at: created + n * 1000 * 60 * 90,
        note: noteFor(s, { severity: cls.severity, authority: cls.authority }),
      })),
      read: true,
      problem: cls.problem,
      severity: cls.severity,
      authority: cls.authority,
      recommendedAction: cls.recommendedAction,
      expectedBy: created + cls.etaHours * 60 * 60 * 1000,
      priorityScore: cls.priorityScore,
      priorityReasoning: cls.priorityReasoning,
      forwardedAt: null,
      forwardedReference: null,
      citizenConfirmedAt: null,
      reopenedCount: 0,
      assignedAuthorityId: null,
      assignedAuthorityName: null,
      assignedOffice: null,
      assignedContact: null,
      routingDistanceKm: null,
      escalationLevel: 1,
      routingStatus: "unassigned",
      routingSlaDeadline: null,
      mcdCategoryId: null,
      mcdSubcategoryId: null,
    };
  };
  return [
    mk(
      0,
      "Broken Streetlight",
      "Work In Progress",
      0.004,
      0.006,
      "Dwarka, Sector 15",
      "Two lamps dark near the Sector 15 park gate, Dwarka.",
    ),
    mk(
      1,
      "Sparking Wire",
      "Assigned to Field Team",
      -0.005,
      0.003,
      "Lajpat Nagar",
      "Wire sparks near the bus stop outside Lajpat Nagar market, dangerous in the rain.",
    ),
    mk(
      2,
      "Power Outage",
      "Resolved",
      0.008,
      -0.004,
      "Karol Bagh",
      "Whole lane without power since evening near Karol Bagh metro station.",
    ),
    mk(
      3,
      "Damaged Pole",
      "Forwarded to Authority",
      -0.003,
      -0.007,
      "Gandhi Nagar",
      "Pole leaning badly after last night's storm, close to Gandhi Nagar bridge.",
    ),
    mk(
      4,
      "Broken Streetlight",
      "AI Classified",
      0.011,
      0.002,
      "Nehru Vihar",
      "Entire stretch outside Nehru Vihar society dark for a week, women feel unsafe walking home.",
    ),
    mk(
      5,
      "Power Outage",
      "Assigned to Field Team",
      -0.007,
      0.009,
      "Vikaspuri",
      "Frequent tripping in Vikaspuri block C, happens every evening around 8 pm.",
    ),
    mk(
      6,
      "Sparking Wire",
      "Resolved",
      0.002,
      -0.011,
      "Yamuna Vihar",
      "Loose wire was touching a tree branch near Yamuna Vihar main road, sparks seen after rain.",
    ),
    mk(
      7,
      "Damaged Pole",
      "Work In Progress",
      -0.009,
      -0.002,
      "Rohini, Sector 7",
      "Pole tilted after a truck hit it near Rohini Sector 7 crossing.",
    ),
    mk(
      8,
      "Other",
      "AI Classified",
      0.006,
      0.013,
      "Mayur Vihar Phase 1",
      "Open junction box with exposed wires near Mayur Vihar Phase 1 bus stand.",
    ),
    mk(
      9,
      "Broken Streetlight",
      "Resolved",
      -0.002,
      0.015,
      "Saket",
      "Streetlight flickering all night outside Saket district park, now fixed.",
    ),
    mk(
      10,
      "Power Outage",
      "AI Classified",
      0.013,
      -0.006,
      "Shahdara",
      "No power in Shahdara market area since this afternoon, shopkeepers affected.",
    ),
    mk(
      11,
      "Sparking Wire",
      "Work In Progress",
      -0.011,
      -0.009,
      "Uttam Nagar",
      "Transformer near Uttam Nagar crossing making a buzzing sound and sparking.",
    ),
    mk(
      12,
      "Damaged Pole",
      "Assigned to Field Team",
      0.009,
      0.008,
      "Munirka",
      "Rusted pole base near Munirka bus depot looks unsafe, wobbles in wind.",
    ),
    mk(
      13,
      "Other",
      "Work In Progress",
      -0.006,
      0.011,
      "Chandni Chowk",
      "Streetlight cable hanging low over the footpath near Chandni Chowk metro gate 3.",
    ),
  ];
}

export function noteFor(status: Status, ctx?: { severity?: Severity; authority?: string }): string {
  switch (status) {
    case "Reported":
      return "Complaint received and logged.";
    case "AI Classified":
      return ctx?.severity && ctx?.authority
        ? `Automatically classified as ${ctx.severity} severity — routed to ${ctx.authority}.`
        : "Automatically classified by AI — severity and routing determined.";
    case "Forwarded to Authority":
      return ctx?.authority
        ? `Complaint forwarded to ${ctx.authority}.`
        : "Forwarded to the responsible authority.";
    case "Assigned to Field Team":
      return "A field crew has been assigned.";
    case "Work In Progress":
      return "Crew is working on the issue.";
    case "Resolved":
      return "Issue fixed and closed.";
  }
}

/** Note attached to the timeline entry when a citizen confirms a
 * "Resolved" complaint is actually fixed. */
export const CITIZEN_CONFIRMED_NOTE = "Citizen confirmed the issue is resolved.";

/** Note attached to the "Work In Progress" timeline entry created when a
 * citizen reports a "Resolved" complaint as not actually fixed. */
export const CITIZEN_REOPENED_NOTE =
  "Citizen reported the issue is not fixed — complaint reopened for further work.";

export function formatDate(ts: number) {
  // Pinned locale + hour cycle so SSR and client hydration produce identical text.
  return new Date(ts).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export const STATUS_TONE: Record<Status, string> = {
  Reported: "bg-muted text-muted-foreground",
  "AI Classified": "bg-secondary text-secondary-foreground",
  "Forwarded to Authority": "bg-accent text-accent-foreground",
  "Assigned to Field Team": "bg-primary/70 text-primary-foreground",
  "Work In Progress": "bg-primary text-primary-foreground",
  Resolved: "bg-success text-success-foreground",
};

export type ComplaintStats = {
  total: number;
  resolved: number;
  inProgress: number;
  pending: number;
  resolutionRate: number;
};

export function getStats(list: Complaint[]): ComplaintStats {
  const total = list.length;
  const resolved = list.filter((c) => c.status === "Resolved").length;
  const inProgress = list.filter(
    (c) => c.status === "Assigned to Field Team" || c.status === "Work In Progress",
  ).length;
  const pending = list.filter(
    (c) =>
      c.status === "Reported" ||
      c.status === "AI Classified" ||
      c.status === "Forwarded to Authority",
  ).length;
  const resolutionRate = total === 0 ? 0 : Math.round((resolved / total) * 100);
  return { total, resolved, inProgress, pending, resolutionRate };
}

/** Straight-line distance in km between two coordinates (flat-earth
 * approximation). Good enough at city scale — mirrors the precision
 * already used by wardFor for this demo's synthetic geodata. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((aLat * Math.PI) / 180);
  const dLat = (aLat - bLat) * kmPerDegLat;
  const dLng = (aLng - bLng) * kmPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Count of complaints within `radiusKm` of a center point — powers the
 * dashboard's "Nearby" stat. Defaults to the demo's city-center pin. */
export function getNearbyCount(
  list: Complaint[],
  center: [number, number] = DEFAULT_CENTER,
  radiusKm = 1.2,
): number {
  return list.filter((c) => distanceKm(c.lat, c.lng, center[0], center[1]) <= radiusKm).length;
}
