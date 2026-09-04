// Small presentation helpers shared across screens.

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  needs_changes: "Needs changes",
  approved: "Approved",
  denied: "Denied",
};

// Status hues. Status is a domain-semantic signal (a reviewer scans the queue by
// color), so it carries a small, intentional palette; everything else uses the
// theme's semantic tokens.
export const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  under_review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  needs_changes: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  denied: "bg-red-500/15 text-red-400 border-red-500/30",
};

export const ACTION_LABELS: Record<string, string> = {
  submit: "Submitted",
  run_checks: "Ran eligibility checks",
  request_changes: "Requested changes",
  approve: "Approved",
  deny: "Denied",
};

export const CHECK_TYPE_LABELS: Record<string, string> = {
  field_present: "must be provided",
  min: "minimum",
  max: "maximum",
  equals: "must equal",
  in_set: "must be one of",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatDate(epochms: unknown): string {
  const n = typeof epochms === "number" ? epochms : Number(epochms);
  if (!n || Number.isNaN(n)) return "";
  return new Date(n).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function titleCaseKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
