import { CircleHelp, Flame, Lightbulb, TrafficCone, ZapOff, type LucideIcon } from "lucide-react";
import type { IssueType } from "@/lib/complaints";

export const ISSUE_ICON: Partial<Record<IssueType, LucideIcon>> = {
  "Broken Streetlight": Lightbulb,
  "Power Outage": ZapOff,
  "Damaged Pole": TrafficCone,
  "Sparking Wire": Flame,
  Other: CircleHelp,
};
